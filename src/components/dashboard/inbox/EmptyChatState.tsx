"use client";

import { MessageSquareText } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function EmptyChatState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center chat-bg gap-5 p-8 text-center">
      <div className="rounded-full bg-primary/10 p-6 text-primary">
        <MessageSquareText className="h-10 w-10" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Painel de atendimento {BRAND.name}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Selecione uma conversa à esquerda para começar a responder.
          Novos atendimentos chegam em tempo real.
        </p>
      </div>
    </div>
  );
}
