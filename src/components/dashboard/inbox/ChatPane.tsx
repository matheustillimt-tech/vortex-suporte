"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Loader2, UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_KEY } from "@/lib/widget-project";
import { BRAND } from "@/lib/brand";
import { useConversationRealtime } from "@/lib/realtime/useConversationRealtime";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageBubble, type ReplyPreview } from "@/components/shared/MessageBubble";
import { AgentComposer } from "../AgentComposer";
import { ContactLabelHeader, ContactLabelPicker } from "../ContactLabels";
import { ChatActionsMenu } from "./ChatActionsMenu";
import { TransferDialog } from "./TransferDialog";
import { CloseReasonDialog } from "./CloseReasonDialog";
import { cn, getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Agent, Conversation, Contact, Message } from "@/lib/supabase/types";

type Props = {
  conversationId: string;
  agent: Pick<Agent, "id" | "name" | "email" | "role">;
  onOpenContact: () => void;
  /** Volta pra lista — usado no botão "voltar" mobile. */
  onBack?: () => void;
  /** Chamado quando o status muda por ação do agente (assumir/finalizar/reabrir).
   *  SupportInbox usa pra sincronizar a aba visível com o novo status. */
  onStatusChanged?: (status: "waiting" | "in_progress" | "closed") => void;
  contactPanelOpen: boolean;
};

export function ChatPane({ conversationId, agent, onOpenContact, onBack, onStatusChanged, contactPanelOpen }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [conv, setConv] = useState<(Conversation & { contact: Contact }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"take" | "close" | "reopen" | "transfer" | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeReasonOpen, setCloseReasonOpen] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: c }, { data: ms }] = await Promise.all([
        supabase
          .from("conversations")
          .select("*, contact:contacts(*)")
          .eq("id", conversationId)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setConv((c as unknown as Conversation & { contact: Contact }) ?? null);
      setMessages((ms ?? []) as Message[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  useConversationRealtime({
    supabase,
    conversationId,
    onMessage: (msg) =>
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])),
    onMessageUpdate: (msg) =>
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))),
    onConversation: (update) =>
      setConv((prev) => (prev ? { ...prev, ...update, contact: prev.contact } : prev)),
  });

  const handleEditMessage = useCallback(async (msgId: string, newBody: string) => {
    const { data, error } = await supabase
      .from("messages")
      .update({ body: newBody, edited_at: new Date().toISOString() })
      .eq("id", msgId)
      .select("*")
      .single();
    if (!error && data) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? (data as Message) : m)));
    }
  }, [supabase]);

  const handleDeleteMessage = useCallback(async (msgId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_type: "agent",
        deleted_by_id: agent.id,
        deleted_by_name: agent.name,
      })
      .eq("id", msgId)
      .select("*")
      .single();
    if (!error && data) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? (data as Message) : m)));
    }
  }, [supabase, agent]);

  const handleTake = useCallback(async () => {
    if (!conv) return;
    setBusy("take");
    const { error } = await supabase
      .from("conversations")
      .update({ status: "in_progress", assigned_agent_id: agent.id })
      .eq("id", conv.id);
    if (!error) {
      // Atualiza state local IMEDIATAMENTE (não espera realtime)
      // — assim os botões e composer aparecem na hora pra o agente responder
      setConv((prev) =>
        prev ? { ...prev, status: "in_progress", assigned_agent_id: agent.id } : prev,
      );
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        author_type: "system",
        body: `${agent.name} assumiu o atendimento.`,
      });
      onStatusChanged?.("in_progress");
    }
    setBusy(null);
  }, [supabase, agent, conv, onStatusChanged]);

  const handleClose = useCallback(async (reason: { id: string | null; label: string; note: string | null }) => {
    if (!conv) return;
    setBusy("close");
    const closedAt = new Date().toISOString();
    const { error } = await supabase
      .from("conversations")
      .update({
        status: "closed",
        closed_at: closedAt,
        close_reason_id: reason.id,
        close_reason_label: reason.label,
        close_reason_note: reason.note,
      })
      .eq("id", conv.id);
    if (!error) {
      setConv((prev) =>
        prev ? {
          ...prev, status: "closed", closed_at: closedAt,
          close_reason_id: reason.id, close_reason_label: reason.label, close_reason_note: reason.note,
        } : prev,
      );
      const reasonText = reason.note ? `${reason.label} — ${reason.note}` : reason.label;
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        author_type: "system",
        body: `Atendimento concluído (${reasonText}).`,
      });
      // Busca mensagem de encerramento configurada e envia como bot
      const { data: settings } = await supabase
        .from("widget_settings")
        .select("closing_message, closing_message_enabled")
        .eq("project_key", PROJECT_KEY)
        .maybeSingle();
      const closingMessage = settings?.closing_message?.trim();
      // A chavinha desliga o envio sem apagar o texto configurado.
      const closingEnabled = settings?.closing_message_enabled !== false;
      if (closingMessage && closingEnabled) {
        await supabase.from("messages").insert({
          conversation_id: conv.id,
          author_type: "bot",
          author_name: BRAND.name,
          body: closingMessage,
        });
      }
      onStatusChanged?.("closed");
      // E-mail de encerramento com a conversa completa (sempre — quem parou de
      // responder também recebe). Falha não desfaz o encerramento: só avisa.
      try {
        const res = await fetch(`/api/admin/conversations/${conv.id}/email-encerramento`, { method: "POST" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({} as { error?: string }));
          alert(
            j.error === "contact_without_email"
              ? "Atendimento finalizado, mas este contato não tem e-mail válido — o resumo não foi enviado."
              : "Atendimento finalizado, mas o e-mail com o resumo não saiu. Tente reabrir e finalizar de novo.",
          );
        }
      } catch {
        alert("Atendimento finalizado, mas o e-mail com o resumo não saiu. Tente reabrir e finalizar de novo.");
      }
    }
    setBusy(null);
  }, [supabase, conv, onStatusChanged]);

  const handleReopen = useCallback(async () => {
    if (!conv) return;
    if (!confirm("Reabrir este atendimento? Ele voltará para a fila de aguardando.")) return;
    setBusy("reopen");
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("conversations")
      .update({
        status: "waiting",
        first_message_at: now,
        last_message_at: now,
        closed_at: null,
        assigned_agent_id: null,
        close_reason_id: null,
        close_reason_label: null,
        close_reason_note: null,
      })
      .eq("id", conv.id);
    if (!error) {
      setConv((prev) =>
        prev ? {
          ...prev,
          status: "waiting",
          first_message_at: now,
          last_message_at: now,
          closed_at: null,
          assigned_agent_id: null,
          close_reason_id: null,
          close_reason_label: null,
          close_reason_note: null,
        } : prev,
      );
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        author_type: "system",
        body: `${agent.name} reabriu o atendimento.`,
      });
      onStatusChanged?.("waiting");
    }
    setBusy(null);
  }, [supabase, conv, agent, onStatusChanged]);

  const handleTransfer = useCallback(async (newAgent: { id: string; name: string }) => {
    if (!conv) return;
    setBusy("transfer");
    const { error } = await supabase
      .from("conversations")
      .update({ status: "in_progress", assigned_agent_id: newAgent.id })
      .eq("id", conv.id);
    if (!error) {
      setConv((prev) =>
        prev ? { ...prev, status: "in_progress", assigned_agent_id: newAgent.id } : prev,
      );
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        author_type: "system",
        body: `${agent.name} transferiu o atendimento para ${newAgent.name}.`,
      });
      onStatusChanged?.("in_progress");
    }
    setBusy(null);
  }, [supabase, conv, agent, onStatusChanged]);

  // Trocou de conversa: a citação pendente não faz mais sentido.
  useEffect(() => { setReplyToId(null); }, [conversationId]);

  // As mensagens da conversa já estão todas em memória, então a citação é
  // resolvida por lookup — sem join nem query extra.
  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const nameOf = useCallback((m: Message): string => {
    if (m.author_type === "agent") return m.author_name ?? "Atendente";
    if (m.author_type === "bot") return m.author_name ?? BRAND.name;
    return m.author_name ?? conv?.contact.name ?? conv?.contact.email ?? "Cliente";
  }, [conv]);

  const previewOf = useCallback((m: Message): ReplyPreview => ({
    id: m.id,
    authorName: nameOf(m),
    body: m.body,
    attachments: m.attachments ?? [],
    deleted: !!m.deleted_at,
  }), [nameOf]);

  const jumpToMessage = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Pisca a mensagem pra pessoa achar no meio do fio.
    el.classList.add("ring-2", "ring-primary", "rounded-lg");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-lg"), 1500);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center chat-bg">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex h-full items-center justify-center chat-bg text-sm text-muted-foreground">
        Conversa não encontrada.
      </div>
    );
  }

  const isMine = conv.assigned_agent_id === agent.id;
  const isAdmin = agent.role === "admin";
  // Assumir: quando está na fila OU já em atendimento com OUTRO agente (qualquer
  // agente pode pegar pra si — resolve o "tá atribuído a outro e não consigo responder").
  const canTake = conv.status === "waiting" || (conv.status === "in_progress" && !isMine);
  // Finalizar: o agente dono da conversa OU um admin (admin gerencia a fila
  // toda — resolve conversas atribuídas a outro agente que não são finalizadas).
  const canClose = conv.status === "in_progress" && (isMine || isAdmin);
  const canReopen = conv.status === "closed";
  const canTransfer = conv.status === "in_progress" && (isMine || isAdmin);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-card px-3 py-3 md:px-4">
        {/* Botão voltar — só mobile */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a lista"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenContact}
          aria-label={`Ver detalhes de ${conv.contact.name || conv.contact.email}`}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors",
            contactPanelOpen ? "bg-secondary/50" : "hover:bg-secondary/40",
          )}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
              {getInitials(conv.contact.name ?? conv.contact.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-2">
              <span className="break-words text-[15px] font-semibold">{conv.contact.name || conv.contact.email}</span>
              {/* Chegou pela tela de login, sem estar logado — e-mail não verificado. */}
              {conv.contact.metadata?.visitante === true && (
                <Badge variant="warning" className="shrink-0 text-[10px]">Visitante</Badge>
              )}
            </div>
            <ContactLabelHeader key={conv.contact_id} contactId={conv.contact_id} />
          </div>
        </button>

        <div className="flex shrink-0 gap-1.5">
          <ContactLabelPicker key={conv.contact_id} contactId={conv.contact_id} />
          <ChatActionsMenu key={conv.id} busy={busy !== null}
            canTake={canTake} canTransfer={canTransfer} canClose={canClose} canReopen={canReopen}
            onTake={() => void handleTake()} onTransfer={() => setTransferOpen(true)}
            onClose={() => setCloseReasonOpen(true)} onReopen={() => void handleReopen()} />
        </div>
      </header>

      {/* Dialog de transferência */}
      <TransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        currentAgentId={agent.id}
        onTransfer={handleTransfer}
      />

      {/* Dialog de motivo da finalização */}
      <CloseReasonDialog
        open={closeReasonOpen}
        onClose={() => setCloseReasonOpen(false)}
        onConfirm={handleClose}
      />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-1.5 overflow-auto scroll-thin chat-bg px-2 py-3 md:px-4 md:py-4"
      >
        {messages.map((m) => {
          const isMyMessage = m.author_type === "agent" && m.author_id === agent.id;
          const quoted = m.reply_to_id ? messagesById.get(m.reply_to_id) : null;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.author_type === "agent"}
              authorName={
                m.author_type === "agent" ? (m.author_name ?? agent.name) :
                m.author_type === "bot"   ? (m.author_name ?? BRAND.name) :
                conv.contact.name ?? undefined
              }
              variant="panel"
              viewer="agent"
              onEdit={isMyMessage ? (body) => handleEditMessage(m.id, body) : undefined}
              onDelete={isMyMessage ? () => handleDeleteMessage(m.id) : undefined}
              replyTo={quoted ? previewOf(quoted) : null}
              onJumpTo={quoted ? jumpToMessage : undefined}
              // Só quem está com o atendimento é que responde — mesma régua do composer.
              onReply={isMine && m.author_type !== "system" ? () => setReplyToId(m.id) : undefined}
            />
          );
        })}
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Aguardando primeira mensagem…
          </div>
        )}
      </div>

      {/* Composer */}
      {conv.status === "closed" ? (
        <div className="border-t border-border/40 bg-card px-6 py-3.5 text-center text-sm text-muted-foreground">
          Atendimento encerrado.{" "}
          <button onClick={handleReopen} className="font-medium text-primary hover:underline">
            Reabrir
          </button>
        </div>
      ) : isMine ? (
        <AgentComposer
          conversationId={conv.id}
          supabase={supabase}
          agentId={agent.id}
          replyTo={(() => {
            const target = replyToId ? messagesById.get(replyToId) : null;
            if (!target) return null;
            const p = previewOf(target);
            return {
              id: p.id,
              authorName: p.authorName,
              preview: p.body?.trim().replace(/\s+/g, " ") || "Anexo",
            };
          })()}
          onCancelReply={() => setReplyToId(null)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2.5 border-t border-border/40 bg-card px-6 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            {conv.status === "waiting"
              ? "Assuma o atendimento para responder."
              : "Este atendimento está com outro agente. Assuma para poder responder."}
          </p>
          <Button onClick={handleTake} disabled={busy !== null} size="sm">
            {busy === "take" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Assumir para responder
          </Button>
        </div>
      )}
    </div>
  );
}
