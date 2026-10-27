import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(["agent", "admin"]).optional(),
  password: z.string().min(6).max(128).optional().or(z.literal("")),
});

// Garante que quem chama é admin logado. Retorna { user } ou uma Response de erro.
async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: me } = await sb.from("agents").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}

// ── EDITAR agente ───────────────────────────────────────────────
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;

  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const { name, email, role, password } = parsed.data;

  const admin = createAdminClient();

  // Trava anti-lockout: o admin não pode rebaixar o PRÓPRIO papel pra atendente.
  if (role === "agent" && id === gate.user!.id) {
    return NextResponse.json({ error: "nao_pode_rebaixar_voce" }, { status: 400 });
  }

  // 1) auth (e-mail / senha) — só se vieram
  if (email || (password && password.length >= 6)) {
    const { error: aErr } = await admin.auth.admin.updateUserById(id, {
      ...(email ? { email, email_confirm: true } : {}),
      ...(password && password.length >= 6 ? { password } : {}),
    });
    if (aErr) {
      const dup = /already|registered|exists/i.test(aErr.message);
      return NextResponse.json({ error: dup ? "email_ja_usado" : aErr.message }, { status: 400 });
    }
  }

  // 2) tabela agents
  const patch: Record<string, string> = {};
  if (name) patch.name = name;
  if (email) patch.email = email;
  if (role) patch.role = role;
  if (Object.keys(patch).length) {
    const { data: agent, error: uErr } = await admin.from("agents").update(patch).eq("id", id).select("*").single();
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    return NextResponse.json({ agent });
  }

  const { data: agent } = await admin.from("agents").select("*").eq("id", id).single();
  return NextResponse.json({ agent });
}

// ── EXCLUIR agente ──────────────────────────────────────────────
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { id } = await ctx.params;

  // não pode excluir a si mesmo
  if (id === gate.user!.id) return NextResponse.json({ error: "nao_pode_excluir_voce" }, { status: 400 });

  const admin = createAdminClient();

  // não pode excluir o último admin (evita ficar sem ninguém com acesso total)
  const { data: target } = await admin.from("agents").select("id,role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "agente_nao_encontrado" }, { status: 404 });
  if (target.role === "admin") {
    const { count } = await admin.from("agents").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return NextResponse.json({ error: "ultimo_admin" }, { status: 400 });
  }

  // 1) remove o registro de agente (FKs de conversas/eventos viram null; mensagens
  //    mantêm o nome do autor, que é desnormalizado).
  const { error: dErr } = await admin.from("agents").delete().eq("id", id);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  // 2) apaga também a conta de login (auth.users). Neste projeto do Supabase
  //    só atendentes têm login — o cliente do widget não tem conta aqui.
  const { error: auErr } = await admin.auth.admin.deleteUser(id);
  const removedAuthUser = !auErr;
  if (auErr) console.error("[admin/agents] deleteUser:", auErr.message);

  return NextResponse.json({ ok: true, removedAuthUser });
}
