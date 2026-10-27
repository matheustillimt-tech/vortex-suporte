import type { createAdminClient } from "@/lib/supabase/admin";
import { BRAND } from "@/lib/brand";

type Admin = ReturnType<typeof createAdminClient>;

export const REOPEN_NOTICE = "Atendimento reaberto pelo cliente.";

export type EnabledTopic = {
  id: string;
  department_id: string | null;
  auto_message: string | null;
  name: string;
};

/** Tema ativo pelo id — desativado ou inexistente volta null (vira "sem tema"). */
export async function findEnabledTopic(supabase: Admin, topicId: string): Promise<EnabledTopic | null> {
  const { data: topic } = await supabase
    .from("support_topics")
    .select("id, department_id, auto_message, name, enabled")
    .eq("id", topicId)
    .maybeSingle();
  if (!topic?.enabled) return null;
  return { id: topic.id, department_id: topic.department_id, auto_message: topic.auto_message, name: topic.name };
}

export function topicGreeting(topic: EnabledTopic): string {
  return topic.auto_message || `Você foi direcionado para ${topic.name}. Em instantes te respondemos.`;
}

/**
 * Devolve um atendimento ENCERRADO pra fila e diz se foi ESTA chamada que reabriu.
 *
 * O UPDATE só pega a linha se ela ainda estiver `closed`. Com duas requisições
 * ao mesmo tempo (duplo clique, duas abas), o Postgres faz a segunda esperar o
 * lock da linha e reavalia o WHERE: ela não acha mais `closed` e volta vazia.
 * Só quem reabriu grava o aviso — nunca sai "reaberto" em dobro, e conversa
 * em andamento nunca é mexida.
 */
export async function reopenIfClosed(
  supabase: Admin,
  conversationId: string,
  topic: EnabledTopic | null = null,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("conversations")
    .update({
      status: "waiting",
      first_message_at: now,
      last_message_at: now,
      closed_at: null,
      assigned_agent_id: null,
      ...(topic ? { topic_id: topic.id, department_id: topic.department_id } : {}),
    })
    .eq("id", conversationId)
    .eq("status", "closed")
    .select("id");
  if (error) throw error;
  if (!data?.length) return false;

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    author_type: "system",
    body: REOPEN_NOTICE,
  });
  if (topic) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      author_type: "bot",
      author_name: BRAND.name,
      body: topicGreeting(topic),
    });
  }
  return true;
}

/**
 * Corrida encerrar × enviar: a atendente encerrou entre a leitura do status e
 * o insert da mensagem do cliente. Sem isso a mensagem ficava dentro de um
 * atendimento encerrado, que ninguém vê. Usa o horário do evento `closed`
 * (gravado pelo banco, não pelo relógio do navegador da atendente): só reabre
 * se o encerramento veio ANTES da mensagem ser salva — encerrar depois de ler
 * a mensagem continua encerrando.
 */
export async function reopenIfClosedBefore(
  supabase: Admin,
  conversationId: string,
  messageCreatedAt: string,
): Promise<boolean> {
  const { data: current } = await supabase
    .from("conversations")
    .select("status")
    .eq("id", conversationId)
    .maybeSingle();
  if (current?.status !== "closed") return false;

  const { data: closedEvent } = await supabase
    .from("conversation_events")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("type", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!closedEvent || Date.parse(closedEvent.created_at) > Date.parse(messageCreatedAt)) return false;

  return reopenIfClosed(supabase, conversationId);
}
