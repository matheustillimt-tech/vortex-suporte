import { MAX_SUPPORT_FILE_BYTES } from "@/lib/support-upload-limits";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/widget-token";
import { BRAND } from "@/lib/brand";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { widgetCorsHeaders, widgetCorsResponse } from "@/lib/security/cors";
import { findEnabledTopic, reopenIfClosed, reopenIfClosedBefore } from "@/lib/conversation-reopen";

export const runtime = "nodejs";

const RL_MAX = 60;
const RL_WINDOW = 60;

export function OPTIONS(req: Request) {
  return widgetCorsResponse(req.headers.get("origin"));
}

const AttachmentSchema = z.object({
  url: z.string().url(),
  mime: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(MAX_SUPPORT_FILE_BYTES),
});

const Body = z.object({
  conversationId: z.string().uuid(),
  body: z.string().max(8000).optional().nullable(),
  attachments: z.array(AttachmentSchema).max(10).optional().default([]),
  /** Tema escolhido no widget — só vale se esta mensagem reabrir o atendimento. */
  topicId: z.string().uuid().optional(),
});

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = widgetCorsHeaders(origin);

  const session = verifySession(bearer(req));
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });

  // Rate-limit por contato (mais útil) + por IP (defesa adicional)
  const ip = clientIp(req);
  const rl = rateLimit({ key: `msg:${session.contactId}:${ip}`, max: RL_MAX, windowSec: RL_WINDOW });
  const rlHeaders = rateLimitHeaders(rl, RL_MAX);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...corsHeaders, ...rlHeaders, "Retry-After": String(RL_WINDOW) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: { ...corsHeaders, ...rlHeaders } });
  }
  const { conversationId, body, attachments, topicId } = parsed.data;

  if (!body?.trim() && (!attachments || attachments.length === 0)) {
    return NextResponse.json({ error: "empty_message" }, { status: 400, headers: { ...corsHeaders, ...rlHeaders } });
  }

  const supabase = createAdminClient();

  // Confirma que a conversa pertence ao contato.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, status, contact_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv || conv.contact_id !== session.contactId) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: { ...corsHeaders, ...rlHeaders } });
  }

  // Atendimento encerrado só volta pra fila com mensagem de verdade do cliente
  // (texto ou anexo — vazio já foi recusado acima). O aviso de reabertura e a
  // saudação do tema entram ANTES da mensagem, na ordem da linha do tempo.
  let reopened = false;
  if (conv.status === "closed") {
    try {
      const topic = topicId ? await findEnabledTopic(supabase, topicId) : null;
      reopened = await reopenIfClosed(supabase, conv.id, topic);
    } catch (error) {
      console.error("[messages] reopen failed:", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "db_error" }, { status: 500, headers: { ...corsHeaders, ...rlHeaders } });
    }
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      author_type: "contact",
      author_id: session.contactId,
      body: body?.trim() || null,
      attachments,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[messages] db error:", error.message);
    return NextResponse.json({ error: "db_error" }, { status: 500, headers: { ...corsHeaders, ...rlHeaders } });
  }

  if (!reopened && conv.status !== "closed") {
    try {
      await reopenIfClosedBefore(supabase, conv.id, message.created_at);
    } catch (error) {
      // A mensagem já está salva; o aviso de reabertura é o que falhou.
      console.error("[messages] late reopen failed:", error instanceof Error ? error.message : error);
    }
  }

  // A conversa pode ter começado durante o expediente. Reavalia a cada
  // mensagem já salva, inclusive anexos, sem alterar responsável ou status.
  try {
    const { data: isOnline, error: hoursError } = await supabase.rpc("is_any_dept_open");
    if (hoursError) throw hoursError;
    if (isOnline === false) {
      const { data: settings, error: settingsError } = await supabase
        .from("widget_settings")
        .select("offline_message")
        .eq("project_key", session.projectKey)
        .maybeSingle();
      if (settingsError) throw settingsError;
      const { error: noticeError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        author_type: "bot",
        author_name: BRAND.name,
        body: settings?.offline_message?.trim()
          || "⚠️ No momento estamos fora do horário de atendimento. Deixe sua mensagem que respondemos assim que possível.",
      });
      if (noticeError) throw noticeError;
    }
  } catch (error) {
    // Nunca faz o cliente reenviar uma mensagem que já foi recebida.
    console.error("[messages] off-hours notice failed:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ message }, { headers: { ...corsHeaders, ...rlHeaders } });
}
