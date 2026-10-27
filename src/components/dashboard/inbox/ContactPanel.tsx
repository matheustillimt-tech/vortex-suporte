"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  AlertTriangle, CheckCircle2, Clock, History, Loader2, MessageSquare, Plus, StickyNote,
  Trash2, UserCheck, UserPlus, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  Agent, Contact, ContactNote, Conversation, ConversationEvent,
} from "@/lib/supabase/types";

type Props = {
  contactId: string;
  conversationId: string;
  /** Dado conhecido (vem do cache da lista) — usado pra renderização instantânea. */
  initialContact: Contact | null;
  agent: Pick<Agent, "id" | "name" | "role">;
  onClose: () => void;
  /** Chamado após apagar conversa com sucesso. */
  onConversationDeleted?: () => void;
};

export function ContactPanel({
  contactId, conversationId, initialContact, agent, onClose, onConversationDeleted,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  // Renderização instantânea com o que já temos
  const [contact, setContact] = useState<Contact | null>(initialContact);
  const [notes, setNotes] = useState<ContactNote[] | null>(null);
  const [events, setEvents] = useState<ConversationEvent[] | null>(null);
  const [allConvs, setAllConvs] = useState<Conversation[] | null>(null);
  const [newNote, setNewNote] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Disparado em background — não bloqueia render
  useEffect(() => {
    let cancelled = false;

    // 4 queries em paralelo, cada uma atualiza só sua section
    supabase
      .from("contacts").select("*").eq("id", contactId).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setContact(data as Contact); });

    supabase
      .from("contact_notes").select("*").eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setNotes((data ?? []) as ContactNote[]); });

    supabase
      .from("conversation_events").select("*").eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setEvents((data ?? []) as ConversationEvent[]); });

    supabase
      .from("conversations").select("*").eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setAllConvs((data ?? []) as Conversation[]); });

    return () => { cancelled = true; };
  }, [supabase, contactId, conversationId]);

  const addNote = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const body = newNote.trim();
    if (!body) return;
    setPostingNote(true);

    // Insere otimistico (UI atualiza antes do round-trip)
    const optimistic: ContactNote = {
      id: `tmp-${Date.now()}`,
      contact_id: contactId,
      author_id: agent.id,
      body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setNotes((p) => [optimistic, ...(p ?? [])]);
    setNewNote("");

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({ contact_id: contactId, author_id: agent.id, body })
      .select("*")
      .single();

    setPostingNote(false);

    if (error) {
      // rollback
      setNotes((p) => (p ?? []).filter((x) => x.id !== optimistic.id));
      alert(error.message);
      return;
    }
    // Troca tmp pelo real
    setNotes((p) =>
      (p ?? []).map((x) => (x.id === optimistic.id ? (data as ContactNote) : x)),
    );
  }, [newNote, supabase, contactId, agent.id]);

  const deleteConversation = useCallback(async () => {
    const name = contact?.name || contact?.email || "este contato";
    const confirmed = confirm(
      `Apagar permanentemente esta conversa com ${name}?\n\n` +
      `• Todas as mensagens (texto, áudios, imagens, arquivos) serão removidas\n` +
      `• O histórico de eventos também\n` +
      `• As notas do contato e o contato em si NÃO serão apagados\n\n` +
      `Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
    setDeleting(false);
    if (error) {
      alert(`Erro ao apagar: ${error.message}`);
      return;
    }
    // NÃO chamar onClose() depois — o onConversationDeleted faz router.replace
    // sem ?c= e o painel desaparece pela condição em SupportInbox.
    // Chamar onClose() depois usaria o `search` capturado (com ?c= antigo) e
    // re-adicionava os params, mantendo o chat visualmente.
    onConversationDeleted?.();
  }, [supabase, conversationId, contact, onConversationDeleted]);

  const removeNote = useCallback(async (noteId: string) => {
    if (!confirm("Excluir esta nota?")) return;
    // otimista
    const before = notes;
    setNotes((p) => (p ?? []).filter((x) => x.id !== noteId));
    const { error } = await supabase.from("contact_notes").delete().eq("id", noteId);
    if (error) {
      setNotes(before);
      alert(error.message);
    }
  }, [supabase, notes]);

  // Header sempre renderiza com o que tem (initialContact ou contact carregado)
  const display = contact;
  const md = (display?.metadata ?? {}) as Record<string, unknown>;
  // Dados que o seu site mandou no identify({ metadata }) — plano, empresa, etc.
  const extras = Object.entries(md)
    .filter(([k, v]) => k !== "visitante" && k !== "origem" && v !== null && v !== undefined && v !== "")
    .slice(0, 20);
  // Veio de uma página sem login (ex.: tela de login do seu app): o e-mail foi digitado
  // por ele e NÃO foi verificado — pode ser o e-mail errado da compra, que é
  // justamente o motivo de estar aqui. Confira no admin antes de mexer na conta.
  const visitante = md.visitante === true;
  const origem = typeof md.origem === "string" ? md.origem : null;

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border/50 bg-card animate-in slide-in-from-right duration-150">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
        <span className="text-sm font-semibold">Detalhes do contato</span>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin">
        {/* HEADER — instantâneo */}
        <div className="flex flex-col items-center gap-2 border-b border-border/40 px-4 py-5 text-center">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/15 text-primary text-base font-semibold">
              {getInitials(display?.name ?? display?.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-[15px] font-semibold">{display?.name ?? "Sem nome"}</div>
            <div className="text-[13px] text-muted-foreground">{display?.email ?? "…"}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {visitante && <Badge variant="warning" className="text-[10px]">Visitante · fora do sistema</Badge>}
          </div>
        </div>

        {/* Info */}
        <Section title="Informações">
          {visitante && (
            <Row
              label="Origem"
              value={`${origem === "tela_login" ? "Tela de login" : origem === "widget" ? "Formulário do widget" : origem ?? "Fora do sistema"} — sem login, e-mail não verificado`}
            />
          )}
          <Row label="External ID" value={display?.external_id ?? "—"} mono />
          <Row
            label="Primeira visita"
            value={display ? format(new Date(display.first_seen_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
          />
          <Row
            label="Última visita"
            value={display ? format(new Date(display.last_seen_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
          />
        </Section>

        {/* Dados enviados pelo seu site (metadata do identify) */}
        {extras.length > 0 && (
          <Section title="Dados do seu sistema">
            {extras.map(([k, v]) => (
              <Row key={k} label={k} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />
            ))}
          </Section>
        )}

        {/* Notas */}
        <Section title="Notas internas" icon={StickyNote}>
          <form onSubmit={addNote} className="space-y-2 px-4 pb-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Anote algo sobre este cliente…"
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-[13px] leading-snug placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="sm" disabled={postingNote || !newNote.trim()} className="w-full">
              {postingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Adicionar nota
            </Button>
          </form>

          {notes === null ? (
            <SkeletonLines lines={2} />
          ) : notes.length === 0 ? (
            <p className="px-4 pb-3 text-xs text-muted-foreground">Sem notas ainda.</p>
          ) : (
            <ul className="space-y-2 px-4 pb-3">
              {notes.map((n) => (
                <li key={n.id} className="group rounded-md border border-border/40 bg-background p-3 text-[13px]">
                  <div className="flex items-center justify-between gap-2 pb-1.5 text-[11px] text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    {!n.id.startsWith("tmp-") && (
                      <button
                        onClick={() => removeNote(n.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Histórico desta conversa */}
        <Section title="Histórico do atendimento" icon={History}>
          {events === null ? (
            <SkeletonLines lines={3} />
          ) : events.length === 0 ? (
            <p className="px-4 pb-3 text-xs text-muted-foreground">Nenhum evento ainda.</p>
          ) : (
            <ul className="space-y-1.5 px-4 pb-3">
              {events.map((e) => <EventRow key={e.id} ev={e} />)}
            </ul>
          )}
        </Section>

        {/* Todos os atendimentos deste contato */}
        <Section title="Outros atendimentos" icon={MessageSquare}>
          {allConvs === null ? (
            <SkeletonLines lines={1} />
          ) : allConvs.length <= 1 ? (
            <p className="px-4 pb-3 text-xs text-muted-foreground">Este é o único atendimento até agora.</p>
          ) : (
            <ul className="space-y-1 px-4 pb-3">
              {allConvs.map((c) => (
                <ConversationHistoryRow key={c.id} conv={c} current={c.id === conversationId} />
              ))}
            </ul>
          )}
        </Section>

        {/* Metadata raw */}
        {Object.keys(md).length > 0 && (
          <Section title="Metadata">
            <details className="px-4 pb-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">Ver JSON bruto</summary>
              <pre className="mt-2 overflow-auto rounded bg-background p-2 text-[10px] leading-tight">
                {JSON.stringify(md, null, 2)}
              </pre>
            </details>
          </Section>
        )}

        {/* Zona de perigo — só admin */}
        {agent.role === "admin" && (
          <Section title="Zona de perigo" icon={AlertTriangle}>
            <div className="space-y-2 px-4 pb-4">
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Esta ação apaga a conversa e todas as mensagens (texto, áudios, imagens, arquivos).
                <br />
                As <b>notas</b> e o <b>contato</b> ficam preservados.
              </p>
              <Button
                onClick={deleteConversation}
                disabled={deleting}
                variant="outline"
                size="sm"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Apagar conversa
              </Button>
            </div>
          </Section>
        )}
      </div>
    </aside>
  );
}

function Section({
  title, icon: Icon, children,
}: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="border-b border-border/30">
      <h3 className="flex items-center gap-1.5 px-4 pt-3.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h3>
      {children}
    </section>
  );
}

function SkeletonLines({ lines }: { lines: number }) {
  return (
    <div className="space-y-2 px-4 pb-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-md bg-secondary/60"
          style={{ width: `${85 - i * 10}%` }}
        />
      ))}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

const EVENT_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  created:     { label: "Conversa criada",     Icon: Plus,         cls: "text-muted-foreground" },
  assigned:    { label: "Assumida por agente", Icon: UserCheck,    cls: "text-primary" },
  transferred: { label: "Transferida",         Icon: UserPlus,     cls: "text-blue-400" },
  closed:      { label: "Encerrada",           Icon: CheckCircle2, cls: "text-emerald-400" },
  reopened:    { label: "Reaberta",            Icon: Clock,        cls: "text-amber-400" },
  note:        { label: "Anotação",            Icon: StickyNote,   cls: "text-muted-foreground" },
};

function EventRow({ ev }: { ev: ConversationEvent }) {
  const meta = EVENT_META[ev.type] ?? EVENT_META.created;
  const Icon = meta.Icon;
  return (
    <li className="flex items-start gap-2 text-xs">
      <div className={cn("mt-0.5", meta.cls)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 leading-tight">
        <div className="font-medium">{meta.label}</div>
        <div className="text-[10px] text-muted-foreground">
          {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </div>
      </div>
    </li>
  );
}

function ConversationHistoryRow({ conv, current }: { conv: Conversation; current: boolean }) {
  return (
    <li
      className={cn(
        "rounded-md border px-2.5 py-2 text-xs",
        current ? "border-primary/40 bg-primary/5" : "border-border/40 bg-background",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {format(new Date(conv.created_at), "dd/MM/yy", { locale: ptBR })}
          {current && <span className="ml-1.5 text-[10px] text-primary">• atual</span>}
        </span>
        <Badge
          variant={conv.status === "closed" ? "muted" : conv.status === "in_progress" ? "success" : "warning"}
          className="text-[9px] px-1.5 py-0"
        >
          {conv.status === "waiting" ? "Aguardando" : conv.status === "in_progress" ? "Atendendo" : "Encerrada"}
        </Badge>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        Última atividade {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
      </div>
    </li>
  );
}
