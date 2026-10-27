"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useInboxRealtime } from "@/lib/realtime/useInboxRealtime";
import { playNotificationPing, unlockAudio } from "@/lib/sound/notification";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContactLabels } from "@/lib/contact-labels";
import { ConversationListItem } from "./ConversationListItem";
import { cn } from "@/lib/utils";
import type {
  Agent, Attachment, AuthorType, Conversation, ConversationStatus, ConversationWithContact, Contact,
} from "@/lib/supabase/types";

type ListAgent = Pick<Agent, "id" | "name" | "email">;

type FilterTab = "waiting" | "in_progress" | "closed";

type Props = {
  initial: ConversationWithContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  tab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  /** Chamado quando uma conversa é apagada (via realtime). */
  onDeleted?: (id: string) => void;
};

export function ConversationList({ initial, selectedId, onSelect, tab, onTabChange, onDeleted }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const { labels, assigned } = useContactLabels(items.map(c => c.contact_id));
  const contactsCache = useRef<Map<string, Contact>>(new Map());
  const agentsCache = useRef<Map<string, ListAgent>>(new Map());

  // mensagens não lidas por conversa (mini badge 1, 2, 3…)
  const [unread, setUnread] = useState<Record<string, number>>({});
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  // ao abrir uma conversa, zera o contador dela
  useEffect(() => {
    if (selectedId) setUnread((u) => (u[selectedId] ? { ...u, [selectedId]: 0 } : u));
  }, [selectedId]);

  // Destrava o áudio no 1º gesto do atendente (política de autoplay do navegador).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Realtime de MENSAGENS: toca o som e conta não-lidas quando chega mensagem
  // NOVA do CLIENTE (author_type 'contact') — não toca pras suas próprias.
  useEffect(() => {
    const channel = supabase
      .channel("inbox:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as {
            conversation_id?: string; author_type?: string; body?: string | null;
            attachments?: unknown; created_at?: string;
          };
          if (!msg?.conversation_id) return;
          const convId = msg.conversation_id;

          // Atualiza a PRÉVIA (última mensagem) da conversa na lista + reordena —
          // pra qualquer autor (cliente OU atendente), como nos apps de mensagem, ao vivo.
          setItems((prev) => {
            const idx = prev.findIndex((c) => c.id === convId);
            if (idx < 0) return prev; // conversa ainda não carregada; o upsert cuida
            const next = [...prev];
            next[idx] = {
              ...prev[idx],
              last_message: [{
                body: msg.body ?? null,
                attachments: (Array.isArray(msg.attachments) ? msg.attachments : []) as Attachment[],
                author_type: (msg.author_type ?? "contact") as AuthorType,
                deleted_at: null,
              }],
              last_message_at: msg.created_at ?? new Date().toISOString(),
              last_author_type: msg.author_type ?? prev[idx].last_author_type,
            };
            return next.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
          });

          // som + contador de não-lidas: só pras mensagens do CLIENTE
          if (msg.author_type !== "contact") return;
          playNotificationPing();
          if (convId !== selectedIdRef.current) {
            setUnread((u) => ({ ...u, [convId]: (u[convId] ?? 0) + 1 }));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Rastreia o último status conhecido de cada conversa, pra disparar som
  // SÓ em transições novas/closed → waiting (não em update de mensagem).
  const previousStatusRef = useRef<Map<string, ConversationStatus>>(new Map());

  useEffect(() => {
    initial.forEach((c) => {
      contactsCache.current.set(c.contact_id, c.contact);
      if (c.assigned_agent) agentsCache.current.set(c.assigned_agent.id, c.assigned_agent);
      previousStatusRef.current.set(c.id, c.status);
    });
  }, [initial]);

  const fetchContact = useCallback(
    async (id: string): Promise<Contact | null> => {
      if (contactsCache.current.has(id)) return contactsCache.current.get(id)!;
      const { data } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
      if (data) contactsCache.current.set(id, data as Contact);
      return (data as Contact) ?? null;
    },
    [supabase],
  );

  // O realtime entrega só a linha de `conversations`, sem os joins. Quando o
  // atendimento troca de dono (assumir/transferir), o nome precisa vir junto —
  // senão a lista continua mostrando quem atendia antes.
  const fetchAgent = useCallback(
    async (id: string | null): Promise<ListAgent | null> => {
      if (!id) return null;
      if (agentsCache.current.has(id)) return agentsCache.current.get(id)!;
      const { data } = await supabase.from("agents").select("id, name, email").eq("id", id).maybeSingle();
      if (data) agentsCache.current.set(id, data as ListAgent);
      return (data as ListAgent) ?? null;
    },
    [supabase],
  );

  const upsert = useCallback(async (conv: Conversation) => {
    previousStatusRef.current.set(conv.id, conv.status);
    const [contact, assignedAgent] = await Promise.all([
      fetchContact(conv.contact_id),
      fetchAgent(conv.assigned_agent_id),
    ]);
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === conv.id);
      const next = [...prev];
      const merged: ConversationWithContact = {
        ...(idx >= 0 ? prev[idx] : ({} as ConversationWithContact)),
        ...conv,
        contact: contact ?? prev[idx]?.contact,
        assigned_agent: assignedAgent,
      };
      if (idx >= 0) next[idx] = merged;
      else next.unshift(merged);
      return next.sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );
    });
    // O som agora vem do realtime de MENSAGENS (mensagem nova do cliente),
    // que cobre também a 1ª mensagem de uma conversa nova.
  }, [fetchContact, fetchAgent]);

  const handleDelete = useCallback((id: string) => {
    previousStatusRef.current.delete(id);
    contactsCache.current.delete(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
    onDeleted?.(id);
  }, [onDeleted]);

  useInboxRealtime({ supabase, onInsert: upsert, onUpdate: upsert, onDelete: handleDelete });

  const filtered = items
    .filter((c) => {
      if (c.status !== (tab as ConversationStatus)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          c.contact?.name?.toLowerCase().includes(q) ||
          c.contact?.email?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // FILA (Aguardando): mais antigo PRIMEIRO (FIFO — quem chegou antes é atendido antes)
      if (tab === "waiting") {
        return new Date(a.first_message_at).getTime() - new Date(b.first_message_at).getTime();
      }
      // Em atendimento / Concluído: atividade recente primeiro
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

  const counts = {
    waiting: items.filter((c) => c.status === "waiting").length,
    in_progress: items.filter((c) => c.status === "in_progress").length,
    closed: items.filter((c) => c.status === "closed").length,
  };

  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* topo */}
      <div className="space-y-3 border-b border-border/50 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="h-9 pl-9 bg-secondary border-transparent text-sm"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => onTabChange(v as FilterTab)}>
          <TabsList className="grid grid-cols-3 w-full h-9 bg-secondary/60 p-0.5">
            <TabPill value="waiting">Aguardando <Count n={counts.waiting} /></TabPill>
            <TabPill value="in_progress">Em atendimento <Count n={counts.in_progress} /></TabPill>
            <TabPill value="closed">Concluído <Count n={counts.closed} /></TabPill>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto scroll-thin">
        {filtered.length === 0 ? (
          <EmptyList query={query} />
        ) : (
          filtered.map((c) => (
            <ConversationListItem
              key={c.id}
              conv={c}
              labels={labels.filter(l => (assigned[c.contact_id] ?? []).includes(l.id))}
              active={c.id === selectedId}
              onClick={() => onSelect(c.id)}
              unread={unread[c.id] ?? 0}
              // "aguardando resposta" = última mensagem foi do CLIENTE e não é a aberta.
              // Vem do banco (last_author_type) → funciona em qualquer aba e ao recarregar.
              awaiting={c.last_author_type === "contact" && c.id !== selectedId}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TabPill({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "h-7 rounded text-[11px] data-[state=active]:bg-card data-[state=active]:text-primary",
        "px-1.5 gap-1",
      )}
    >
      {children}
    </TabsTrigger>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="rounded bg-primary/20 px-1 text-[9px] font-semibold text-primary">{n}</span>;
}

function EmptyList({ query }: { query: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
      <Inbox className="h-7 w-7" />
      <p className="text-sm">
        {query ? `Sem resultados para "${query}".` : "Nenhuma conversa por aqui."}
      </p>
    </div>
  );
}
