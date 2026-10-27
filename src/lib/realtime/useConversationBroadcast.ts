"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Message } from "@/lib/supabase/types";

type Args = {
  supabase: SupabaseClient;
  conversationId: string | null;
  onMessage: (msg: Message) => void;
  onMessageUpdate?: (msg: Partial<Message> & { id: string }) => void;
  onConversation: (conv: Partial<Conversation> & { id: string }) => void;
};

/**
 * Realtime para o widget (cliente anônimo).
 *
 * Postgres Changes não funciona pro widget porque ele usa anon key e a
 * RLS bloqueia SELECT em messages/conversations. Sem SELECT, sem evento.
 *
 * Solução: triggers Postgres chamam realtime.send() em canal PÚBLICO
 * `wc:<conv_id>`. Aqui assinamos esse canal via Broadcast API — funciona
 * sem auth.
 */
export function useConversationBroadcast({
  supabase, conversationId, onMessage, onMessageUpdate, onConversation,
}: Args) {
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`wc:${conversationId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        onMessage(payload as Message);
      })
      .on("broadcast", { event: "msg_update" }, ({ payload }) => {
        onMessageUpdate?.(payload as Partial<Message> & { id: string });
      })
      .on("broadcast", { event: "conv_update" }, ({ payload }) => {
        onConversation(payload as Conversation);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, onMessage, onMessageUpdate, onConversation]);
}
