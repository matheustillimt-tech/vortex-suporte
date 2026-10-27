"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, Headset, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "@/components/shared/MessageBubble";
import { WidgetComposer } from "./WidgetComposer";
import { getInitials } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import type { QueueSnapshot } from "@/lib/realtime/useQueuePosition";
import type { Conversation, Message } from "@/lib/supabase/types";

type Props = {
  conv: Conversation;
  messages: Message[];
  contactId: string;
  sessionToken: string;
  onSent: (msg: Message) => void;
  /** Quando preenchido (status=waiting), mostra banner com posição na fila. */
  queue?: QueueSnapshot | null;
  /** Tema escolhido no widget, enviado junto da mensagem que reabrir o atendimento. */
  topicId?: string;
  /** Patches uma mensagem local após edit/delete (otimismo). */
  onMessagePatched?: (msg: Message) => void;
};

const ORDINAIS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
function ordinal(n: number): string {
  return ORDINAIS[n - 1] ?? `${n}º`;
}

export function ChatPanel({
  conv, messages, contactId, sessionToken, onSent, queue, topicId, onMessagePatched,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // "Iniciar novo atendimento" só libera o campo de digitar. Quem reabre é o
  // servidor, quando chega texto ou anexo: tocar no botão (ou só ler o chat)
  // não devolve o caso pra fila.
  const [replying, setReplying] = useState(false);
  useEffect(() => {
    if (conv.status !== "closed") setReplying(false);
  }, [conv.status]);

  async function editMessage(id: string, body: string) {
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return;
    const { message } = await res.json();
    onMessagePatched?.(message as Message);
  }

  async function deleteMessage(id: string) {
    const res = await fetch(`/api/messages/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) return;
    // Otimismo: marca apagada localmente até polling/broadcast confirmar.
    const local = messages.find((m) => m.id === id);
    if (local) {
      onMessagePatched?.({
        ...local,
        deleted_at: new Date().toISOString(),
        deleted_by_type: "contact",
        deleted_by_id: contactId,
        deleted_by_name: local.author_name,
      });
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Tenta descobrir o nome do atendente atual a partir das mensagens já vistas.
  const agentName = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.author_type === "agent" && m.author_name) return m.author_name;
    }
    return null;
  }, [messages]);

  const isWaiting = conv.status === "waiting";
  const showAgentBanner = conv.status === "in_progress" && agentName;
  const showQueueBanner = isWaiting && !!queue;

  // No widget, mensagens apagadas somem completamente — sem placeholder.
  // Dashboard mantém histórico via `viewer="agent"` em MessageBubble.
  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.deleted_at),
    [messages],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Banner do agente (quando assumido) */}
      {showAgentBanner && (
        <div className="flex items-center gap-2.5 border-b border-border/60 bg-primary/10 px-4 py-2.5 animate-fade-in">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
              {getInitials(agentName)}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Headset className="h-3 w-3" /> Você está conversando com
            </div>
            <div className="text-sm font-semibold">{agentName}</div>
          </div>
        </div>
      )}

      {/* Banner de fila (quando aguardando) */}
      {showQueueBanner && (
        <QueueBanner queue={queue} />
      )}

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto scroll-thin px-4 py-3 bg-muted/20">
        {visibleMessages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Envie sua primeira mensagem para iniciar.
          </div>
        )}
        {visibleMessages.map((m) => {
          const mine = m.author_type === "contact" && m.author_id === contactId;
          // Busca na lista COMPLETA: a citação continua válida mesmo se a
          // mensagem original tiver sido apagada (some da lista visível).
          const quoted = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              mine={mine}
              authorName={
                m.author_type === "agent" || m.author_type === "bot"
                  ? m.author_name ?? (m.author_type === "bot" ? BRAND.name : undefined)
                  : undefined
              }
              viewer="widget"
              replyTo={quoted ? {
                id: quoted.id,
                authorName: quoted.author_type === "contact"
                  ? "Você"
                  : quoted.author_name ?? (quoted.author_type === "bot" ? BRAND.name : "Atendente"),
                body: quoted.body,
                attachments: quoted.attachments ?? [],
                deleted: !!quoted.deleted_at,
              } : null}
              onEdit={mine ? (body) => editMessage(m.id, body) : undefined}
              onDelete={mine ? () => deleteMessage(m.id) : undefined}
            />
          );
        })}
      </div>

      {conv.status !== "closed" || replying ? (
        <>
          {conv.status === "closed" && (
            <p className="border-t border-border/40 bg-card px-4 pt-2.5 text-center text-xs text-muted-foreground">
              Envie sua mensagem para iniciar um novo atendimento.
            </p>
          )}
          <WidgetComposer
            conversationId={conv.id}
            sessionToken={sessionToken}
            onSent={onSent}
            topicId={conv.status === "closed" ? topicId : undefined}
            autoFocus={replying}
          />
        </>
      ) : (
        <div className="border-t border-border/40 bg-card p-4 space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Este atendimento foi encerrado
          </div>
          <Button
            onClick={() => setReplying(true)}
            className="w-full"
            size="sm"
          >
            <RotateCcw className="h-4 w-4" />
            Iniciar novo atendimento
          </Button>
        </div>
      )}
    </div>
  );
}

function QueueBanner({ queue }: { queue: QueueSnapshot }) {
  const isFirst = queue.position === 1;
  return (
    <div className="border-b border-border/60 bg-primary/5 px-4 py-2.5 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="rounded-full bg-primary/15 p-1.5 text-primary">
          <Clock className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11px] text-muted-foreground">
            {queue.departmentName ? `Fila do setor ${queue.departmentName}` : "Aguardando atendimento"}
          </div>
          <div className="text-sm font-semibold">
            {isFirst
              ? "Você é o próximo! 🎉"
              : `Sua posição: ${ordinal(queue.position)} de ${queue.totalWaiting}`}
          </div>
        </div>
      </div>
    </div>
  );
}
