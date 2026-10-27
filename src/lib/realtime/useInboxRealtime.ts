"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation } from "@/lib/supabase/types";

type Args = {
  supabase: SupabaseClient;
  onInsert: (conv: Conversation) => void;
  onUpdate: (conv: Conversation) => void;
  /** Disparado quando uma conversa é apagada — payload só tem o id. */
  onDelete?: (id: string) => void;
};

export function useInboxRealtime({ supabase, onInsert, onUpdate, onDelete }: Args) {
  useEffect(() => {
    const channel = supabase
      .channel("inbox:conversations")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        (payload) => onInsert(payload.new as Conversation),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload) => onUpdate(payload.new as Conversation),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversations" },
        (payload) => {
          const id = (payload.old as { id?: string })?.id;
          if (id && onDelete) onDelete(id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, onInsert, onUpdate, onDelete]);
}
