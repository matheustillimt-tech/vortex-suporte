"use client";
import { LabelBadges } from "../ContactLabels";
import type { ContactLabel } from "@/lib/contact-labels";

import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ConversationWithContact } from "@/lib/supabase/types";

// Só o primeiro nome: o badge divide a linha com a prévia da mensagem e o
// nome completo empurraria o texto. O nome inteiro fica no title (hover).
function firstName(full?: string | null): string | null {
  const first = full?.trim().split(/\s+/)[0];
  return first || null;
}

function fmt(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm", { locale: ptBR });
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yy", { locale: ptBR });
}

// Prévia da última mensagem (como nos apps de mensagem). Texto, ou placeholder pra anexo/
// apagada. Volta null (usa o e-mail) quando não há mensagem.
function previewText(conv: ConversationWithContact): { text: string; deleted?: boolean } | null {
  const m = conv.last_message?.[0];
  if (!m) return null;
  if (m.deleted_at) return { text: "Mensagem apagada", deleted: true };
  if (m.body?.trim()) return { text: m.body.trim().replace(/\s+/g, " ") };
  const att = m.attachments?.[0];
  if (att) {
    const mime = att.mime || "";
    if (mime.startsWith("image/")) return { text: "📷 Foto" };
    if (mime.startsWith("video/")) return { text: "🎥 Vídeo" };
    if (mime.startsWith("audio/")) return { text: "🎧 Áudio" };
    return { text: "📎 Arquivo" };
  }
  return null;
}

export function ConversationListItem({
  conv, active, onClick, unread = 0, awaiting = false, labels = [],
}: {
  conv: ConversationWithContact;
  labels?: ContactLabel[];
  active: boolean;
  onClick: () => void;
  /** mensagens novas (não lidas) recebidas AO VIVO — mostra a contagem (1,2,3…) */
  unread?: number;
  /** cliente mandou a última mensagem (do banco) — destaca mesmo sem contagem ao vivo */
  awaiting?: boolean;
}) {
  const name = conv.contact?.name || conv.contact?.email || "Sem nome";
  const status = conv.status;
  const hasUnread = unread > 0 || awaiting;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 border-b border-border/30 px-3 py-3 text-left transition-colors",
        active ? "bg-secondary" : "hover:bg-secondary/50",
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11">
          <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        {/* bolinha verde no avatar quando há mensagem nova */}
        {hasUnread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn("text-[14.5px] truncate", hasUnread ? "font-bold text-foreground" : "font-medium")}>{name}</span>
          </span>
          <span className={cn("text-[11px] shrink-0", hasUnread ? "font-semibold text-emerald-500" : "text-muted-foreground")}>{fmt(conv.last_message_at)}</span>
        </div>
        <LabelBadges labels={labels} />
        <div className="flex items-center gap-2">
          {(() => {
            const p = previewText(conv);
            const fromAgent = (conv.last_message?.[0]?.author_type ?? conv.last_author_type) === "agent";
            return (
              <span className={cn("min-w-0 flex-1 flex items-center gap-1 text-xs truncate", hasUnread ? "text-foreground" : "text-muted-foreground")}>
                {p && fromAgent && <CheckCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                <span className={cn("truncate", p?.deleted && "italic opacity-80")}>
                  {p ? p.text : conv.contact?.email}
                </span>
              </span>
            );
          })()}
          {status === "waiting" && (
            <Badge variant="warning" className="shrink-0 text-[10px] px-1.5 py-0.5">Aguardando</Badge>
          )}
          {status === "in_progress" && (
            <Badge
              variant="success"
              className="shrink-0 text-[10px] px-1.5 py-0.5"
              title={conv.assigned_agent?.name ? `Em atendimento com ${conv.assigned_agent.name}` : undefined}
            >
              {/* Quem está atendendo importa mais que o fato de estar em atendimento —
                  o status já se vê pela aba. Sem dono (raro), volta pro rótulo genérico. */}
              {firstName(conv.assigned_agent?.name) ?? "Atendendo"}
            </Badge>
          )}
          {/* contagem ao vivo (1, 2, 3…) quando houver; senão, bolinha de "aguardando resposta" */}
          {unread > 0 ? (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : awaiting ? (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-label="Aguardando sua resposta" />
          ) : null}
        </div>
      </div>
    </button>
  );
}
