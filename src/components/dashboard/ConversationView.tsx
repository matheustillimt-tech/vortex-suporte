"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useConversationRealtime } from "@/lib/realtime/useConversationRealtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { MessageBubble } from "@/components/shared/MessageBubble";
import { AgentComposer } from "./AgentComposer";
import type { Agent, Conversation, Contact, Message } from "@/lib/supabase/types";

type Props = {
  agent: Pick<Agent, "id" | "name" | "email" | "role">;
  conversation: Conversation & { contact: Contact };
  initialMessages: Message[];
};

export function ConversationView({ agent, conversation: initialConv, initialMessages }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [conv, setConv] = useState<Conversation & { contact: Contact }>(initialConv);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [busy, setBusy] = useState<"take" | "close" | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  useConversationRealtime({
    supabase,
    conversationId: conv.id,
    onMessage: (msg) =>
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])),
    onConversation: (update) =>
      setConv((prev) => ({ ...prev, ...update, contact: prev.contact })),
  });

  const handleTake = useCallback(async () => {
    setBusy("take");
    const { error } = await supabase
      .from("conversations")
      .update({ status: "in_progress", assigned_agent_id: agent.id })
      .eq("id", conv.id);
    if (!error) {
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        author_type: "system",
        body: `${agent.name} assumiu o atendimento.`,
      });
    }
    setBusy(null);
  }, [supabase, agent, conv.id]);

  const handleClose = useCallback(async () => {
    setBusy("close");
    const { error } = await supabase
      .from("conversations")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", conv.id);
    if (!error) {
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        author_type: "system",
        body: "Atendimento concluído.",
      });
      router.push("/inbox");
    }
    setBusy(null);
  }, [supabase, conv.id, router]);

  const canTake = conv.status === "waiting";
  const canClose = conv.status === "in_progress" && conv.assigned_agent_id === agent.id;
  const isMine = conv.assigned_agent_id === agent.id;

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{getInitials(conv.contact.name ?? conv.contact.email)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{conv.contact.name || conv.contact.email}</span>
                <StatusBadge status={conv.status} />
              </div>
              <div className="text-xs text-muted-foreground">{conv.contact.email}</div>
            </div>
          </div>

          <div className="flex gap-2">
            {canTake && (
              <Button onClick={handleTake} disabled={busy !== null}>
                {busy === "take" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Assumir
              </Button>
            )}
            {canClose && (
              <Button variant="outline" onClick={handleClose} disabled={busy !== null}>
                {busy === "close" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Finalizar
              </Button>
            )}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto scroll-thin bg-muted/20 px-6 py-4">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.author_type === "agent"}
              authorName={m.author_type === "agent" ? agent.name : conv.contact.name ?? undefined}
            />
          ))}
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aguardando primeira mensagem...
            </div>
          )}
        </div>

        {conv.status !== "closed" ? (
          isMine ? (
            <AgentComposer conversationId={conv.id} supabase={supabase} agentId={agent.id} />
          ) : (
            <div className="border-t bg-card px-6 py-4 text-sm text-muted-foreground">
              {conv.status === "waiting"
                ? "Assuma o atendimento para responder."
                : "Atendimento atribuído a outro agente."}
            </div>
          )
        ) : (
          <div className="border-t bg-card px-6 py-4 text-sm text-muted-foreground">
            Atendimento encerrado.
          </div>
        )}
      </div>

      <ContactPanel contact={conv.contact} />
    </div>
  );
}

function StatusBadge({ status }: { status: Conversation["status"] }) {
  if (status === "waiting") return <Badge variant="warning">Aguardando</Badge>;
  if (status === "in_progress") return <Badge variant="success">Em atendimento</Badge>;
  return <Badge variant="muted">Concluído</Badge>;
}

function ContactPanel({ contact }: { contact: Contact }) {
  const md = (contact.metadata ?? {}) as Record<string, unknown>;

  return (
    <aside className="hidden w-72 shrink-0 border-l bg-card p-4 lg:block">
      <h3 className="mb-3 text-sm font-semibold">Contato</h3>
      <dl className="space-y-2 text-sm">
        <Field label="Nome" value={contact.name ?? "—"} />
        <Field label="E-mail" value={contact.email} />
        {contact.external_id && <Field label="ID externo" value={contact.external_id} />}
        <Field label="Primeira visita" value={new Date(contact.first_seen_at).toLocaleString("pt-BR")} />
        <Field label="Última visita" value={new Date(contact.last_seen_at).toLocaleString("pt-BR")} />
      </dl>

      {Object.keys(md).length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted-foreground">Dados do seu sistema</summary>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(md, null, 2)}</pre>
        </details>
      )}
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}
