import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { isEmailConfigured, sendConversationClosedEmail } from "@/lib/email/resend";
import { BRAND } from "@/lib/brand";
import { montarEmailEncerramento, type MensagemDoResumo } from "@/lib/email/encerramento";
import type { Attachment } from "@/lib/supabase/types";

export const runtime = "nodejs";

// Anti-abuso — o botão de finalizar chama uma vez por conversa.
const RL_MAX = 60;
const RL_WINDOW = 600;

// Manda pro cliente o e-mail de encerramento com a conversa completa. Chamado
// pelo painel logo depois de finalizar (ChatPane.handleClose). Sempre envia —
// quem parou de responder também recebe, é a prova de que foi atendido.
// Falha aqui NÃO desfaz o encerramento. Sem Resend configurado, não faz nada.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Mesma régua da RLS: qualquer agente pode finalizar, então qualquer agente manda.
  const { data: me } = await sb.from("agents").select("id, name").eq("id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // E-mail é opcional: sem RESEND_API_KEY/RESEND_FROM_EMAIL, o encerramento segue sem e-mail.
  if (!isEmailConfigured()) return NextResponse.json({ ok: false, skipped: "email_not_configured" });

  const ip = clientIp(req);
  const rl = rateLimit({ key: `admin:email-encerramento:${user.id}:${ip}`, max: RL_MAX, windowSec: RL_WINDOW });
  if (rl.blocked) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(RL_WINDOW) } });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("conversations")
    .select("id, status, closed_at, close_reason_label, close_reason_note, contact_id")
    .eq("id", id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (conv.status !== "closed") return NextResponse.json({ error: "not_closed" }, { status: 409 });

  const { data: contact } = await admin.from("contacts").select("email, name").eq("id", conv.contact_id).maybeSingle();
  const to = (contact?.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: "contact_without_email" }, { status: 422 });

  const { data: rows } = await admin
    .from("messages")
    .select("author_type, author_name, body, attachments, created_at, deleted_at")
    .eq("conversation_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  const mensagens: MensagemDoResumo[] = (rows ?? []).map((m) => ({
    autor: m.author_type as MensagemDoResumo["autor"],
    nome: (m.author_name as string | null) ?? null,
    texto: (m.body as string | null) ?? null,
    anexos: (((m.attachments as Attachment[] | null) ?? []).map((a) => ({ name: a.name, url: a.url }))),
    em: m.created_at as string,
  }));

  const email = montarEmailEncerramento({
    nomeDoCliente: (contact?.name as string | null) ?? null,
    nomeDoAtendente: (me.name as string | null) ?? null,
    motivo: (conv.close_reason_label as string | null) ?? null,
    observacao: (conv.close_reason_note as string | null) ?? null,
    encerradoEm: (conv.closed_at as string | null) ?? new Date().toISOString(),
    mensagens,
    linkDoChat: BRAND.siteUrl,
    marca: BRAND.name,
  });

  try {
    const r = await sendConversationClosedEmail(to, email);
    if (r.error) throw new Error(r.error.message);
  } catch (e) {
    console.error("[email-encerramento] falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  // Fica registrado na conversa (o cliente também vê no chat que o resumo foi).
  await admin.from("messages").insert({
    conversation_id: id,
    author_type: "system",
    body: `Um resumo deste atendimento foi enviado para ${to}.`,
  });

  return NextResponse.json({ ok: true, to });
}
