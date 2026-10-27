// Teste REAL da reabertura idempotente num Postgres 17 local (não roda no
// `node --test tests/*.cjs`: precisa de um Postgres embutido, fora das
// dependências do app). Como rodar, numa pasta qualquer:
//   npm i embedded-postgres@17.6.0-beta.15 pg
//   node tests/pg/reabertura-concorrencia.cjs <essa-pasta>
//
// O que prova: o UPDATE que src/lib/conversation-reopen.ts manda pelo PostgREST
// (`update ... where id = $1 and status = 'closed' returning id`) reabre UMA vez
// mesmo com várias requisições ao mesmo tempo — a segunda espera o lock da linha,
// reavalia o WHERE em READ COMMITTED e volta vazia. O gatilho de eventos é o
// mesmo de supabase/migrations/0008_one_contact_one_conv.sql (emit_conversation_event).
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const [, , base] = process.argv;

let falhas = 0, ok = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log("  ok  ", msg); } else { falhas++; console.log("  FALHA", msg); } };

const CONV = "11111111-1111-4111-8111-111111111111";
const schemaSql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/0008_one_contact_one_conv.sql"), "utf8").replace(/\r\n/g, "\n");
const ini = schemaSql.indexOf("do $$ begin\n  create type public.conversation_event_type");
const fim = schemaSql.indexOf("for each row execute function public.emit_conversation_event();", schemaSql.indexOf("create trigger conv_events_trigger_update"));
const EVENTOS = schemaSql.slice(ini, fim) + "for each row execute function public.emit_conversation_event();";

const SCHEMA = `
create table public.conversations (
  id uuid primary key, status text not null check (status in ('waiting','in_progress','closed')),
  assigned_agent_id uuid, closed_at timestamptz, first_message_at timestamptz, last_message_at timestamptz,
  topic_id uuid, department_id uuid);
${EVENTOS.replace(/alter table public\.conversation_events enable row level security;[\s\S]*?using \(public\.is_agent\(\)\);/, "")}
`;

// Exatamente o que reopenIfClosed manda.
const REABRE = `update public.conversations set status='waiting', first_message_at=now(), last_message_at=now(),
  closed_at=null, assigned_agent_id=null where id=$1 and status='closed' returning id`;

async function main() {
  const EmbeddedPostgres = (await import(pathToFileURL(path.join(base, "node_modules/embedded-postgres/dist/index.js")).href)).default;
  const { Client } = require(path.join(base, "node_modules/pg"));
  const dir = path.join(base, "data-reabertura-" + Date.now());
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "x", port: 54398, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
  await pg.initialise(); await pg.start();
  const conecta = async () => { const c = new Client({ host: "localhost", port: 54398, user: "postgres", password: "x", database: "postgres" }); await c.connect(); return c; };
  const c = await conecta();
  const extras = await Promise.all([1, 2, 3, 4].map(conecta));
  const q = (s, p) => c.query(s, p);
  const reaberturas = async () => (await q("select count(*)::int n from public.conversation_events where type='reopened'")).rows[0].n;
  const status = async () => (await q("select status from public.conversations where id=$1", [CONV])).rows[0].status;
  try {
    console.log("Postgres", (await q("show server_version")).rows[0].server_version);
    await q(SCHEMA);
    await q("insert into public.conversations (id, status, closed_at) values ($1, 'closed', now())", [CONV]);

    console.log("\n== Duas requisições sobrepostas (uma segura o lock)");
    const [a, b] = extras;
    await a.query("begin");
    const ra = await a.query(REABRE, [CONV]);
    const pendente = b.query(REABRE, [CONV]); // fica esperando o lock de A
    await new Promise((r) => setTimeout(r, 300));
    await a.query("commit");
    const rb = await pendente;
    check(ra.rowCount === 1, "a primeira reabre");
    check(rb.rowCount === 0, "a segunda reavalia o WHERE depois do lock e não acha mais 'closed'");
    check(await reaberturas() === 1, "um único evento 'reopened'");

    console.log("\n== Quatro requisições ao mesmo tempo");
    await q("update public.conversations set status='closed', closed_at=now() where id=$1", [CONV]);
    const rs = await Promise.all(extras.map((x) => x.query(REABRE, [CONV])));
    check(rs.reduce((n, r) => n + r.rowCount, 0) === 1, "exatamente uma reabre (as outras voltam vazias)");
    check(await reaberturas() === 2, "um evento 'reopened' por ciclo de encerramento");

    console.log("\n== Atendimento em curso não é tocado");
    await q("update public.conversations set status='in_progress', assigned_agent_id=gen_random_uuid() where id=$1", [CONV]);
    const r = await q(REABRE, [CONV]);
    check(r.rowCount === 0 && await status() === "in_progress", "in_progress continua in_progress, com atendente");
    check((await q("select assigned_agent_id is not null a from public.conversations")).rows[0].a, "atribuição preservada");

    console.log("\n== Encerrar × reabrir: o evento 'closed' tem o relógio do banco");
    const ev = (await q("select type, created_at from public.conversation_events order by created_at")).rows.map((e) => e.type);
    check(JSON.stringify(ev.filter((t) => t === "reopened" || t === "closed")) === JSON.stringify(["reopened", "closed", "reopened"]), "linha do tempo: reopened, closed, reopened");
  } finally {
    for (const x of [c, ...extras]) await x.end().catch(() => {});
    await pg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
