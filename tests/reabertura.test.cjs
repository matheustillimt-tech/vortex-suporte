// Atendimento encerrado só volta pra fila com mensagem real do cliente.
// Bug antigo: o botão "Iniciar novo atendimento" chamava /api/conversations
// com reopen=true e devolvia o caso pra "Aguardando" antes de qualquer mensagem.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const CONV = '11111111-1111-4111-8111-111111111111';
const TOPIC = '22222222-2222-4222-8222-222222222222';
const OFF_TOPIC = '33333333-3333-4333-8333-333333333333';
const REOPEN = 'Atendimento reaberto pelo cliente.';

// Banco em memória com a semântica que importa do Postgres: o UPDATE avalia o
// WHERE no momento em que roda (como a reavaliação depois do lock da linha), e
// o gatilho emit_conversation_event grava closed/reopened com o relógio do banco.
function fakeDb({ status = 'closed', online = true } = {}) {
  let clock = Date.parse('2026-10-22T12:00:00Z');
  const now = () => new Date(clock += 1000).toISOString();
  let seq = 0;
  const hooks = { beforeContactInsert: null, afterContactInsert: null };
  const db = {
    conversations: [{ id: CONV, contact_id: 'customer', status, closed_at: status === 'closed' ? now() : null, assigned_agent_id: status === 'in_progress' ? 'agent' : null, topic_id: null, department_id: 'dep-antigo', first_message_at: 'x', last_message_at: 'x', created_at: 'x' }],
    messages: [],
    conversation_events: [],
    support_topics: [
      { id: TOPIC, department_id: 'dep-tema', auto_message: null, name: 'Suporte técnico', enabled: true },
      { id: OFF_TOPIC, department_id: 'dep-off', auto_message: 'x', name: 'Desligado', enabled: false },
    ],
    widget_settings: [{ project_key: 'principal', offline_message: 'Fora do horário' }],
  };
  const emit = (old, row) => {
    if (old.status === row.status) return;
    if (row.status === 'closed') db.conversation_events.push({ conversation_id: row.id, type: 'closed', created_at: now() });
    else if (row.status === 'waiting' && old.status === 'closed') db.conversation_events.push({ conversation_id: row.id, type: 'reopened', created_at: now() });
  };
  // Atendente encerra pelo painel (ChatPane.handleClose): update + aviso de sistema.
  const agentClose = () => {
    const row = db.conversations[0];
    const old = { ...row };
    Object.assign(row, { status: 'closed', closed_at: now() });
    emit(old, row);
    db.messages.push({ id: 'm' + (++seq), conversation_id: CONV, author_type: 'system', body: 'Atendimento concluído (teste).', created_at: now() });
  };
  const from = (table) => {
    const filters = [];
    let op = 'select', payload = null, order = null, lim = null;
    const run = async () => {
      await new Promise((r) => setImmediate(r)); // cada ida ao banco cede a vez
      if (op === 'insert') {
        if (table === 'messages' && payload.author_type === 'contact') hooks.beforeContactInsert?.();
        const row = { id: 'm' + (++seq), created_at: now(), ...payload };
        db[table].push(row);
        if (table === 'messages' && payload.author_type === 'contact') hooks.afterContactInsert?.();
        return { data: [{ ...row }], error: null };
      }
      let rows = db[table].filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        for (const r of rows) { const old = { ...r }; Object.assign(r, payload); if (table === 'conversations') emit(old, r); }
        return { data: rows.map((r) => ({ id: r.id })), error: null };
      }
      if (order) rows = [...rows].sort((a, b) => (a[order.k] < b[order.k] ? -1 : 1) * (order.asc ? 1 : -1));
      if (lim) rows = rows.slice(0, lim);
      return { data: rows.map((r) => ({ ...r })), error: null };
    };
    const one = () => run().then(({ data, error }) => ({ data: data[0] ?? null, error }));
    const b = {
      select: () => b,
      eq: (k, v) => (filters.push((r) => r[k] === v), b),
      order: (k, o) => ((order = { k, asc: o?.ascending !== false }), b),
      limit: (n) => ((lim = n), b),
      update: (d) => ((op = 'update'), (payload = d), b),
      insert: (d) => ((op = 'insert'), (payload = d), b),
      maybeSingle: one,
      single: one,
      then: (res, rej) => run().then(res, rej),
    };
    return b;
  };
  const client = {
    from,
    rpc: async () => ({ data: online, error: null }),
  };
  return { db, client, hooks, agentClose, conv: () => db.conversations[0], bodies: () => db.messages.map((m) => `${m.author_type}:${m.body ?? '[anexo]'}`) };
}

// Carrega um .ts do app transpilado; "@/x" resolve para src/x.ts quando existe.
function load(file, deps) {
  const cache = {};
  const req = (id) => {
    if (deps[id]) return deps[id];
    if (id.startsWith('@/')) {
      const f = path.join('src', id.slice(2) + '.ts');
      if (fs.existsSync(f)) return (cache[f] ??= load(f, deps));
    }
    if (id === 'zod') return require('zod');
    throw new Error('dependência inesperada: ' + id);
  };
  const exports = {};
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(out, { exports, require: req, console: { error: () => {} }, Response, Request, URL, Date, Promise, setImmediate });
  return exports;
}

function app(opts) {
  const f = fakeDb(opts);
  const deps = {
    'next/server': { NextResponse: { json: (data, init) => new Response(JSON.stringify(data), init) } },
    '@/lib/supabase/admin': { createAdminClient: () => f.client },
    '@/lib/widget-token': { verifySession: () => ({ contactId: 'customer', projectKey: 'principal' }) },
    '@/lib/security/rate-limit': { clientIp: () => '', rateLimit: () => ({ blocked: false }), rateLimitHeaders: () => ({}) },
    '@/lib/security/cors': { widgetCorsHeaders: () => ({}), widgetCorsResponse: () => new Response() },
    '@/lib/support-upload-limits': { MAX_SUPPORT_FILE_BYTES: 419430400 },
    '@/lib/brand': { BRAND: { name: 'Sua Empresa' } },
  };
  const messages = load('src/app/api/messages/route.ts', deps);
  const conversations = load('src/app/api/conversations/route.ts', deps);
  const post = (route, body) => route.POST(new Request('https://test/api', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }));
  return {
    ...f,
    send: (body) => post(messages, { conversationId: CONV, ...body }),
    open: (body = {}) => post(conversations, body),
    reopenEvents: () => f.db.conversation_events.filter((e) => e.type === 'reopened').length,
  };
}

const ANEXO = { url: 'https://test/print.png', mime: 'image/png', name: 'print.png', size: 1200 };

test('abrir o widget, ler e tocar no botão (POST /api/conversations) não reabrem — nem com reopen:true de widget antigo', async () => {
  const a = app();
  for (const body of [{}, { reopen: true }, { reopen: true, topicId: TOPIC }, { topicId: TOPIC }]) {
    const r = await a.open(body);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.conversation.status, 'closed');
    assert.equal(j.reopened, false);
  }
  assert.equal(a.conv().status, 'closed');
  assert.equal(a.reopenEvents(), 0);
  assert.deepEqual(a.db.messages, []);
});

test('mensagem vazia não reabre', async () => {
  const a = app();
  assert.equal((await a.send({ body: '   ' })).status, 400);
  assert.equal(a.conv().status, 'closed');
  assert.equal(a.db.messages.length, 0);
});

test('texto após o encerramento reabre uma vez, com o aviso ANTES da mensagem', async () => {
  const a = app();
  assert.equal((await a.send({ body: 'Voltei, ainda com dúvida' })).status, 200);
  const c = a.conv();
  assert.equal(c.status, 'waiting');
  assert.equal(c.assigned_agent_id, null);
  assert.equal(c.closed_at, null);
  assert.equal(c.department_id, 'dep-antigo', 'sem tema novo, mantém o departamento');
  assert.deepEqual(a.bodies(), [`system:${REOPEN}`, 'contact:Voltei, ainda com dúvida']);
  assert.equal(a.reopenEvents(), 1);
});

test('anexo sem texto também reabre', async () => {
  const a = app();
  assert.equal((await a.send({ attachments: [ANEXO] })).status, 200);
  assert.equal(a.conv().status, 'waiting');
  assert.deepEqual(a.bodies(), [`system:${REOPEN}`, 'contact:[anexo]']);
});

test('tema escolhido vai na primeira mensagem: troca departamento e saúda antes da mensagem', async () => {
  const a = app();
  await a.send({ body: 'Oi', topicId: TOPIC });
  assert.equal(a.conv().topic_id, TOPIC);
  assert.equal(a.conv().department_id, 'dep-tema');
  assert.deepEqual(a.bodies(), [`system:${REOPEN}`, 'bot:Você foi direcionado para Suporte técnico. Em instantes te respondemos.', 'contact:Oi']);
});

test('tema desativado é ignorado e não troca o departamento', async () => {
  const a = app();
  await a.send({ body: 'Oi', topicId: OFF_TOPIC });
  assert.equal(a.conv().department_id, 'dep-antigo');
  assert.deepEqual(a.bodies(), [`system:${REOPEN}`, 'contact:Oi']);
});

test('tema só vale para reabrir: em atendimento aberto não mexe no departamento', async () => {
  const a = app({ status: 'in_progress' });
  await a.send({ body: 'Oi', topicId: TOPIC });
  assert.equal(a.conv().status, 'in_progress');
  assert.equal(a.conv().department_id, 'dep-antigo');
  assert.equal(a.conv().assigned_agent_id, 'agent', 'atribuição preservada');
  assert.deepEqual(a.bodies(), ['contact:Oi']);
});

test('duplo clique / duas abas: duas mensagens simultâneas reabrem uma vez só', async () => {
  const a = app();
  const rs = await Promise.all([a.send({ body: 'aba 1' }), a.send({ body: 'aba 2' }), a.send({ attachments: [ANEXO] })]);
  assert.deepEqual(rs.map((r) => r.status), [200, 200, 200]);
  assert.equal(a.conv().status, 'waiting');
  assert.equal(a.reopenEvents(), 1);
  assert.equal(a.bodies().filter((b) => b === `system:${REOPEN}`).length, 1);
  assert.equal(a.bodies().filter((b) => b.startsWith('contact:')).length, 3, 'nenhuma mensagem perdida');
  assert.equal(a.bodies()[0], `system:${REOPEN}`);
});

test('corrida: atendente encerra entre a leitura e o envio → a mensagem reabre (não fica escondida)', async () => {
  const a = app({ status: 'in_progress' });
  a.hooks.beforeContactInsert = () => { a.hooks.beforeContactInsert = null; a.agentClose(); };
  assert.equal((await a.send({ body: 'ainda tô aqui' })).status, 200);
  assert.equal(a.conv().status, 'waiting');
  assert.equal(a.reopenEvents(), 1);
  assert.deepEqual(a.bodies().slice(-2), ['contact:ainda tô aqui', `system:${REOPEN}`]);
});

test('corrida: atendente encerra DEPOIS de a mensagem chegar → continua encerrado', async () => {
  const a = app({ status: 'in_progress' });
  a.hooks.afterContactInsert = () => { a.hooks.afterContactInsert = null; a.agentClose(); };
  await a.send({ body: 'obrigado!' });
  assert.equal(a.conv().status, 'closed');
  assert.equal(a.reopenEvents(), 0);
});

test('atendimento em curso: nenhuma escrita na conversa', async () => {
  for (const status of ['waiting', 'in_progress']) {
    const a = app({ status });
    await a.send({ body: 'Oi' });
    assert.equal(a.conv().status, status);
    assert.equal(a.conv().first_message_at, 'x', 'lugar na fila preservado');
    assert.deepEqual(a.bodies(), ['contact:Oi']);
  }
});

test('fora do horário: reabre pela mensagem e o aviso de ausência vem depois dela', async () => {
  const a = app({ online: false });
  await a.send({ body: 'Oi, de madrugada' });
  assert.equal(a.conv().status, 'waiting');
  assert.deepEqual(a.bodies(), [`system:${REOPEN}`, 'contact:Oi, de madrugada', 'bot:Fora do horário']);
});

test('enviar → encerrar → enviar de novo: cada ciclo reabre exatamente uma vez', async () => {
  const a = app();
  await a.send({ body: '1' });
  a.agentClose();
  await a.send({ body: '2' });
  assert.equal(a.reopenEvents(), 2);
  assert.equal(a.conv().status, 'waiting');
});

// ---- Widget (código-fonte): nada no cliente reabre sozinho -----------------
const src = (f) => fs.readFileSync(f, 'utf8');

test('widget nunca manda reopen para /api/conversations', () => {
  const app = src('src/components/widget/WidgetApp.tsx');
  assert.doesNotMatch(app, /reopen/i);
  assert.doesNotMatch(src('src/components/widget/ChatPanel.tsx'), /api\/conversations|onReopen/);
});

test('"Iniciar novo atendimento" só libera o campo de digitar', () => {
  const panel = src('src/components/widget/ChatPanel.tsx');
  const label = panel.lastIndexOf('Iniciar novo atendimento');
  const button = panel.slice(panel.lastIndexOf('<Button', label), label);
  assert.match(button, /onClick=\{\(\) => setReplying\(true\)\}/);
  assert.match(panel, /conv\.status !== "closed" \|\| replying \? \(/, 'composer aparece ao responder');
  assert.match(panel, /if \(conv\.status !== "closed"\) setReplying\(false\)/, 'novo encerramento volta a mostrar o botão');
  assert.match(panel, /topicId=\{conv\.status === "closed" \? topicId : undefined\}/);
  assert.match(src('src/components/widget/WidgetComposer.tsx'), /\.\.\.\(topicId \? \{ topicId \} : \{\}\)/);
});

test('escolher tema não dispara duas cargas: uma por vez, sem perder mensagem inicial', () => {
  const app = src('src/components/widget/WidgetApp.tsx');
  assert.match(app, /if \(inFlight && !prefillBody\) return inFlight;/);
  assert.match(app, /if \(ensuring\.current === run\) ensuring\.current = null;/);
});
