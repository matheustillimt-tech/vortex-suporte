"use client";

import { useEffect, useRef, useState } from "react";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Ban, Check, CornerUpLeft, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import type { Attachment, Message } from "@/lib/supabase/types";
import { AttachmentBubble } from "./Attachment";
import { cn } from "@/lib/utils";

/** Resumo da mensagem citada, já resolvido por quem renderiza (tem o nome do autor). */
export type ReplyPreview = {
  id: string;
  authorName: string;
  body: string | null;
  attachments: Attachment[];
  deleted: boolean;
};

/** Texto curto pro bloco de citação: corpo, ou o tipo do anexo. */
function replySummary(reply: ReplyPreview): string {
  if (reply.deleted) return "Mensagem apagada";
  const body = reply.body?.trim().replace(/\s+/g, " ");
  if (body) return body;
  const mime = reply.attachments?.[0]?.mime ?? "";
  if (mime.startsWith("image/")) return "📷 Foto";
  if (mime.startsWith("video/")) return "🎥 Vídeo";
  if (mime.startsWith("audio/")) return "🎧 Áudio";
  if (mime) return "📎 Arquivo";
  return "Mensagem";
}

/**
 * Timestamp inteligente — hoje mostra só hora, ontem mostra "ontem HH:mm",
 * dentro da última semana mostra o dia da semana ("ter 14:32"),
 * mais antigo mostra dd/MM HH:mm. Dia da semana ajuda o atendente a
 * localizar rapidamente quando uma msg foi trocada.
 */
function formatMessageTime(date: Date) {
  if (isToday(date)) return format(date, "HH:mm", { locale: ptBR });
  if (isYesterday(date)) return `ontem ${format(date, "HH:mm", { locale: ptBR })}`;
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff < 7) return format(date, "EEE HH:mm", { locale: ptBR });
  return format(date, "dd/MM HH:mm", { locale: ptBR });
}

type Props = {
  message: Message;
  mine: boolean;
  authorName?: string;
  /** "panel" usa os balões do painel do atendente; "default" usa estilo neutro (widget) */
  variant?: "panel" | "default";
  /** Quem está vendo — widget mascara apagados, agente vê histórico. */
  viewer?: "widget" | "agent";
  /** Habilita menu de ações na própria bolha. Sem callbacks, sem menu. */
  onEdit?: (newBody: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  /** Mensagem citada por esta — renderiza o bloco de citação no topo da bolha. */
  replyTo?: ReplyPreview | null;
  /** Habilita "Responder" no menu. Vale pra QUALQUER mensagem, não só as próprias. */
  onReply?: () => void;
  /** Clique na citação pula pra mensagem original. */
  onJumpTo?: (messageId: string) => void;
};

export function MessageBubble({
  message, mine, authorName, variant = "default",
  viewer = "agent", onEdit, onDelete, replyTo, onReply, onJumpTo,
}: Props) {
  if (message.author_type === "system") {
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-md bg-white/5 px-3 py-1 text-[11px] text-muted-foreground/90">
          {message.body}
        </span>
      </div>
    );
  }

  const isPanel = variant === "panel";
  const isDeleted = !!message.deleted_at;
  // Widget esconde conteúdo apagado; dashboard mantém pra trilha de moderação.
  const hideContent = isDeleted && viewer === "widget";
  const canEdit = mine && !isDeleted && message.author_type !== "bot" && !!onEdit;
  const canDelete = mine && !isDeleted && message.author_type !== "bot" && !!onDelete;
  // Responder é o oposto de editar/apagar: o alvo natural é a mensagem do OUTRO.
  const canReply = !isDeleted && !!onReply;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  async function commitEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === (message.body ?? "").trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onEdit?.(trimmed);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Apagar esta mensagem? O cliente verá 'Mensagem apagada'.")) return;
    setMenuOpen(false);
    setBusy(true);
    try {
      await onDelete?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      // âncora pro "pular pra mensagem citada"
      data-message-id={message.id}
      className={cn("group flex w-full gap-2 animate-fade-in", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "relative max-w-[78%] space-y-1.5 px-3.5 py-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
          isPanel
            ? mine
              ? "bubble-out"
              : "bubble-in"
            : mine
              ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-2xl rounded-bl-sm bg-muted",
          hideContent && "italic opacity-80",
          busy && "opacity-60",
        )}
      >
        {/* Menu trigger — aparece quando há alguma ação disponível */}
        {(canEdit || canDelete || canReply) && !editing && (
          <div
            ref={menuRef}
            className={cn(
              "absolute -top-2 opacity-0 transition-opacity group-hover:opacity-100",
              mine ? "-left-2" : "-right-2",
            )}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Ações da mensagem"
              className="rounded-full bg-card p-1 shadow-md ring-1 ring-border/60 hover:bg-secondary"
            >
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {menuOpen && (
              <div
                className={cn(
                  "absolute top-7 z-10 min-w-[140px] overflow-hidden rounded-md border border-border/60 bg-card text-foreground shadow-lg",
                  mine ? "left-0" : "right-0",
                )}
              >
                {canReply && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onReply?.(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <CornerUpLeft className="h-3.5 w-3.5" /> Responder
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setDraft(message.body ?? ""); setEditing(true); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Apagar para todos
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Citação da mensagem respondida — some junto com o conteúdo quando
            a própria mensagem foi apagada. */}
        {replyTo && !hideContent && !editing && (
          <button
            type="button"
            onClick={() => onJumpTo?.(replyTo.id)}
            disabled={!onJumpTo}
            className={cn(
              "flex w-full gap-2 overflow-hidden rounded-md border-l-[3px] px-2 py-1.5 text-left",
              isPanel ? "border-l-[#53bdeb] bg-black/25" : "border-l-current/40 bg-black/10",
              onJumpTo && "transition-opacity hover:opacity-80",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className={cn("text-[11.5px] font-semibold", isPanel ? "text-[#53bdeb]" : "opacity-90")}>
                {replyTo.authorName}
              </div>
              <div className={cn("truncate text-[12.5px] leading-snug opacity-75", replyTo.deleted && "italic")}>
                {replySummary(replyTo)}
              </div>
            </div>
          </button>
        )}

        {!mine && authorName && !hideContent && (
          <div className={cn("text-[12px] font-semibold", isPanel ? "text-[#53bdeb]" : "opacity-80")}>
            {authorName}
          </div>
        )}

        {hideContent ? (
          <p className="flex items-center gap-1.5 whitespace-pre-wrap text-[14px] leading-[1.45] text-current/70">
            <Ban className="h-3.5 w-3.5" /> Mensagem apagada
          </p>
        ) : editing ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void commitEdit(); }
                if (e.key === "Escape") setEditing(false);
              }}
              disabled={busy}
              className="w-full min-w-[200px] resize-none rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-[14.5px] text-foreground outline-none focus:border-primary/60"
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
                className="rounded-md p-1 hover:bg-secondary disabled:opacity-50"
                aria-label="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void commitEdit()}
                disabled={busy || !draft.trim()}
                className="rounded-md bg-primary p-1 text-primary-foreground hover:opacity-90 disabled:opacity-50"
                aria-label="Salvar edição"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {message.attachments.map((att, i) => (
                  <AttachmentBubble key={i} att={att} />
                ))}
              </div>
            )}
            {message.body && (
              <p className="whitespace-pre-wrap text-[14.5px] leading-[1.45] break-words">{message.body}</p>
            )}
          </>
        )}

        {/* Selo "apagada" no dashboard — só p/ viewer agent */}
        {isDeleted && viewer === "agent" && (
          <div className={cn("flex items-center gap-1 text-[10.5px] italic", isPanel ? "text-white/55" : "opacity-60")}>
            <Ban className="h-3 w-3" /> Apagada
            {message.deleted_by_name && ` por ${message.deleted_by_name}`}
          </div>
        )}

        <div className={cn("flex items-center justify-end gap-1 text-[11px]", isPanel ? "text-white/55" : "opacity-60")}>
          {message.edited_at && !hideContent && <span className="italic">editada</span>}
          <span>{formatMessageTime(new Date(message.created_at))}</span>
        </div>
      </div>
    </div>
  );
}
