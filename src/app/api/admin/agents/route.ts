import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

// Anti-abuse — admin pode criar até 10 agentes / hora.
const RL_MAX = 10;
const RL_WINDOW = 3600;

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(["agent", "admin"]).default("agent"),
});

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await sb.from("agents").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Rate limit por admin (id) + IP
  const ip = clientIp(req);
  const rl = rateLimit({ key: `admin:agents:${user.id}:${ip}`, max: RL_MAX, windowSec: RL_WINDOW });
  if (rl.blocked) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(RL_WINDOW) } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const { name, email, password, role } = parsed.data;

  const admin = createAdminClient();

  // Cria o usuário de login. Se o e-mail JÁ existir neste projeto do Supabase
  // (ex.: atendente removido e cadastrado de novo, ou criado à mão no painel do
  // Supabase), reaproveita a conta e só a vincula como agente — SEM trocar a
  // senha dela.
  let userId: string;
  let reused = false;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
  } else {
    const existingId = await findAuthUserIdByEmail(admin, email);
    if (!existingId) {
      console.error("[admin/agents] createUser:", cErr?.message);
      return NextResponse.json({ error: "auth_create_failed" }, { status: 500 });
    }
    userId = existingId;
    reused = true;
  }

  // Já está cadastrado como agente?
  const { data: alreadyAgent } = await admin.from("agents").select("id").eq("id", userId).maybeSingle();
  if (alreadyAgent) {
    return NextResponse.json({ error: "already_agent" }, { status: 409 });
  }

  const { data: agent, error: aErr } = await admin
    .from("agents")
    .insert({ id: userId, name, email, role })
    .select("*")
    .single();

  if (aErr) {
    // rollback do usuário SÓ se fomos nós que o criamos — NUNCA apagar uma conta
    // que já existia (seria apagar a conta de um cliente!).
    if (!reused) await admin.auth.admin.deleteUser(userId);
    console.error("[admin/agents] db insert:", aErr.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ agent, reused });
}

// Procura o id do usuário de login por e-mail (admin API do Supabase Auth). Usado
// quando o e-mail já existe e queremos reaproveitar a conta em vez de falhar.
async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const wanted = email.toLowerCase();
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return null;
      const match = data.users.find((u) => (u.email ?? "").toLowerCase() === wanted);
      if (match) return match.id;
      if (data.users.length < 1000) return null;
    }
    return null;
  } catch {
    return null;
  }
}
