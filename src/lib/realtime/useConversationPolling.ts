"use client";

import { useEffect, useRef } from "react";
import type { Conversation, Message } from "@/lib/supabase/types";

type Args = {
  enabled: boolean;
  conversationId: string | null;
  sessionToken: string | null;
  intervalMs?: number;
  /** Disparado pra cada mensagem nova (não duplica). */
  onMessage: (msg: Message) => void;
  /** Disparado quando uma mensagem existente é editada ou apagada. */
  onMessageUpdate?: (msg: Message) => void;
  /** Disparado quando a conversa muda (status, agente, etc.) */
  onConversation: (conv: Conversation) => void;
};

/**
 * Polling do widget — busca /api/conversations?id=... a cada N segundos e
 * dispara callbacks pra mensagens novas e atualizações de status.
 *
 * Por quê?  O widget usa anon key. Realtime Postgres Changes não funciona
 * (RLS bloqueia). Broadcast também depende de config específica do projeto.
 * Polling via API (que usa service_role no server) é a opção mais robusta.
 *
 * Cost: ~20 requests/min/cliente. OK pra MVP.
 */
export function useConversationPolling({
  enabled, conversationId, sessionToken, intervalMs = 3000,
  onMessage, onMessageUpdate, onConversation,
}: Args) {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const msgSnapshotRef = useRef<Map<string, string>>(new Map());
  const lastConvSnapshotRef = useRef<string>("");

  useEffect(() => {
    if (!enabled || !conversationId || !sessionToken) {
      seenIdsRef.current.clear();
      msgSnapshotRef.current.clear();
      lastConvSnapshotRef.current = "";
      return;
    }
    let active = true;

    async function tick() {
      try {
        const res = await fetch(`/api/conversations?id=${conversationId}`, {
          headers: { authorization: `Bearer ${sessionToken}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversation: Conversation;
          messages: Message[];
        };
        if (!active) return;

        // Atualiza conversa só se algo mudou (evita re-render desnecessário)
        const snapshot = JSON.stringify({
          status: data.conversation.status,
          agent: data.conversation.assigned_agent_id,
          closed: data.conversation.closed_at,
          first: data.conversation.first_message_at,
        });
        if (snapshot !== lastConvSnapshotRef.current) {
          lastConvSnapshotRef.current = snapshot;
          onConversation(data.conversation);
        }

        // Detecta mensagens novas / editadas / apagadas.
        // Hash leve da msg pega edição+exclusão sem comparar JSON completo.
        for (const msg of data.messages) {
          const hash = `${msg.body ?? ""}|${msg.edited_at ?? ""}|${msg.deleted_at ?? ""}|${msg.attachments?.length ?? 0}`;
          if (!seenIdsRef.current.has(msg.id)) {
            seenIdsRef.current.add(msg.id);
            msgSnapshotRef.current.set(msg.id, hash);
            onMessage(msg);
          } else if (msgSnapshotRef.current.get(msg.id) !== hash) {
            msgSnapshotRef.current.set(msg.id, hash);
            onMessageUpdate?.(msg);
          }
        }
      } catch {
        /* swallow — próximo tick tenta de novo */
      }
    }

    void tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [enabled, conversationId, sessionToken, intervalMs, onMessage, onMessageUpdate, onConversation]);
}
