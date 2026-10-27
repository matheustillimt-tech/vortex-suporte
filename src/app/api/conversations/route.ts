import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/widget-token";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

const PostBody = z.object({
  contactName: z.string().min(1).max(120).optional(),
  topicId: z.string().uuid().optional(),
  /**
   * Ignorado. Widgets antigos ainda mandam `reopen: true` no botão "Iniciar novo
   * atendimento", mas reabrir aqui devolvia o caso pra fila sem nenhuma
   * mensagem. Agora quem reabre é o /api/messages, na primeira mensagem real.
   */
  reopen: z.boolean().optional(),
});

// POST /api/conversations
// Cria/recupera conversa do contato. Aceita topicId pra roteamento de departamento.
export async function POST(req: Request) {
  const session = verifySession(bearer(req));
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const supabase = createAdminClient();
  const { contactName, topicId } = parsed.data;

  // Atualiza nome do contato se vier no payload.
  if (contactName) {
    await supabase.from("contacts").update({ name: contactName }).eq("id", session.contactId);
  }

  // Resolve o tema (pra pegar department_id + auto_message)
  let topicDeptId: string | null = null;
  let topicAutoMessage: string | null = null;
  let topicName: string | null = null;
  if (topicId) {
    const { data: topic } = await supabase
      .from("support_topics")
      .select("id, department_id, auto_message, name, enabled")
      .eq("id", topicId)
      .maybeSingle();
    if (topic?.enabled) {
      topicDeptId = topic.department_id;
      topicAutoMessage = topic.auto_message;
      topicName = topic.name;
    }
  }

  // 1 contato = 1 conversa. Sempre reaproveita a mais recente.
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("contact_id", session.contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();

  // Existe e está ativa → devolve direto (ignora topic — já tem atendimento em curso).
  if (existing && (existing.status === "waiting" || existing.status === "in_progress")) {
    return NextResponse.json({ conversation: existing, resumed: true });
  }

  // Existe e está encerrada → devolve como está, com o histórico. Abrir o
  // widget, ler ou tocar em "Iniciar novo atendimento" não reabre: o caso só
  // volta pra fila quando o cliente manda texto ou anexo (/api/messages).
  if (existing && existing.status === "closed") {
    return NextResponse.json({ conversation: existing, resumed: true, reopened: false });
  }

  // Verifica horário — primeiro contato FORA do horário entra como "closed"
  // (não polui a fila). Quando o cliente voltar pra mandar nova msg, a
  // logic de reabertura do /api/messages reativa como "waiting".
  const { data: isOnline } = await supabase.rpc("is_any_dept_open");
  const isOffline = isOnline === false;

  // Primeiro contato — cria nova conversa.
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      contact_id: session.contactId,
      status: isOffline ? "closed" : "waiting",
      first_message_at: now,
      last_message_at: now,
      closed_at: isOffline ? now : null,
      ...(topicId ? { topic_id: topicId, department_id: topicDeptId } : {}),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "db_error", details: error.message }, { status: 500 });

  if (isOffline) {
    // Off-hours: primeira msg é a de fora-de-horário (vira contexto pro
    // atendente futuro saber que o cliente tentou contato antes do expediente)
    const { data: settings } = await supabase
      .from("widget_settings")
      .select("offline_message")
      .eq("project_key", session.projectKey)
      .maybeSingle();
    const offlineBody = settings?.offline_message?.trim()
      || "Cliente entrou em contato fora do horário de atendimento.";
    await supabase.from("messages").insert({
      conversation_id: created.id,
      author_type: "bot",
      author_name: BRAND.name,
      body: `🕐 Contato recebido fora do horário de atendimento.\n\n${offlineBody}`,
    });
  } else {
    // Online: mensagem de boas-vindas normal
    const finalAutoMessage = topicAutoMessage
      || (topicName
        ? `Você foi direcionado para ${topicName}. Em instantes te respondemos.`
        : "Olá! Você entrou na fila de atendimento. Em instantes te respondemos.");
    await supabase.from("messages").insert({
      conversation_id: created.id,
      author_type: "bot",
      author_name: BRAND.name,
      body: finalAutoMessage,
    });
  }

  return NextResponse.json({ conversation: created, resumed: false });
}

// GET /api/conversations?id=...
// Retorna conversa + mensagens + posição na fila (filtrada por departamento).
export async function GET(req: Request) {
  const session = verifySession(bearer(req));
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, topic:support_topics(id, name)")
    .eq("id", id)
    .eq("contact_id", session.contactId)
    .maybeSingle();

  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Posição na fila — filtrada por departamento se a conversa tiver setor definido.
  let queue: {
    position: number;
    totalInProgress: number;
    totalWaiting: number;
    departmentName: string | null;
  } | null = null;

  if (conversation.status === "waiting") {
    const deptId = conversation.department_id;

    // Query base de "à minha frente"
    let aheadQ = supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", "waiting")
      .lt("first_message_at", conversation.first_message_at);
    // Query "em atendimento agora"
    let inProgressQ = supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress");
    // Total aguardando (incluindo eu)
    let totalWaitingQ = supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", "waiting");

    if (deptId) {
      aheadQ = aheadQ.eq("department_id", deptId);
      inProgressQ = inProgressQ.eq("department_id", deptId);
      totalWaitingQ = totalWaitingQ.eq("department_id", deptId);
    }

    const [
      { count: ahead },
      { count: inProgress },
      { count: totalWaiting },
      deptInfo,
    ] = await Promise.all([
      aheadQ,
      inProgressQ,
      totalWaitingQ,
      deptId
        ? supabase.from("departments").select("name").eq("id", deptId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    queue = {
      position: (ahead ?? 0) + 1,
      totalInProgress: inProgress ?? 0,
      totalWaiting: totalWaiting ?? 0,
      departmentName: (deptInfo as { data: { name: string } | null }).data?.name ?? null,
    };
  }

  return NextResponse.json({ conversation, messages: messages ?? [], queue });
}
