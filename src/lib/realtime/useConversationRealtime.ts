"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Message } from "@/lib/supabase/types";

type Args = {
  supabase: SupabaseClient;
  conversationId: string | null;
  onMessage: (msg: Message) => void;
  onMessageUpdate?: (msg: Message) => void;
  onConversation: (conv: Partial<Conversation> & { id: string }) => void;
};

export function useConversationRealtime({
  supabase,
  conversationId,
  onMessage,
  onMessageUpdate,
  onConversation,
}: Args) {
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => onMessage(payload.new as Message),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => onMessageUpdate?.(payload.new as Message),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => onConversation(payload.new as Conversation),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, onMessage, onMessageUpdate, onConversation]);
}
