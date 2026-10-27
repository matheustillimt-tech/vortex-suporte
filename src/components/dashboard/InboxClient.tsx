"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Inbox, CircleDot, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SUPPORT_TITLE } from "@/lib/brand";
import { useInboxRealtime } from "@/lib/realtime/useInboxRealtime";
import { playNotificationPing, unlockAudio } from "@/lib/sound/notification";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ConversationStatus,
  ConversationWithContact,
  Conversation,
  Contact,
} from "@/lib/supabase/types";

type Props = { initial: ConversationWithContact[] };

export function InboxClient({ initial }: Props) {
  const [items, setItems] = useState<ConversationWithContact[]>(initial);
  const [tab, setTab] = useState<ConversationStatus>("waiting");
  const supabase = useMemo(() => createClient(), []);
  const contactsCache = useRef<Map<string, Contact>>(new Map());
  // status conhecido de cada conversa — pra só tocar o som quando ALGUÉM NOVO
  // entra na fila (insert "waiting" ou reabertura), não a cada atualização.
  const knownStatus = useRef<Map<string, ConversationStatus>>(new Map());
  const unseen = useRef(0); // novos atendimentos não vistos (badge no título da aba)

  useEffect(() => {
    initial.forEach((c) => {
      contactsCache.current.set(c.contact_id, c.contact);
      knownStatus.current.set(c.id, c.status);
    });
  }, [initial]);

  // Libera o áudio no primeiro gesto do atendente (política de autoplay dos browsers).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Badge no título da aba ("(2) • Inbox") quando chega gente e o atendente
  // está em outra janela/aba. Zera ao voltar o foco.
  const baseTitle = useRef<string>("");
  useEffect(() => {
    baseTitle.current = document.title || SUPPORT_TITLE;
    const clear = () => {
      if (document.visibilityState === "visible") {
        unseen.current = 0;
        document.title = baseTitle.current;
      }
    };
    document.addEventListener("visibilitychange", clear);
    window.addEventListener("focus", clear);
    return () => {
      document.removeEventListener("visibilitychange", clear);
      window.removeEventListener("focus", clear);
      document.title = baseTitle.current;
    };
  }, []);

  const fetchContact = useCallback(
    async (id: string): Promise<Contact | null> => {
      if (contactsCache.current.has(id)) return contactsCache.current.get(id)!;
      const { data } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
      if (data) contactsCache.current.set(id, data as Contact);
      return (data as Contact) ?? null;
    },
    [supabase],
  );

  const upsert = useCallback(async (conv: Conversation) => {
    // alguém NOVO entrou na fila? (1ª vez que vemos a conversa em "waiting",
    // ou ela voltou pra "waiting" vinda de outro status) → notifica.
    const prevStatus = knownStatus.current.get(conv.id);
    const isNewWaiting = conv.status === "waiting" && prevStatus !== "waiting";
    knownStatus.current.set(conv.id, conv.status);

    const contact = await fetchContact(conv.contact_id);
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === conv.id);
      const next = [...prev];
      const merged: ConversationWithContact = {
        ...(idx >= 0 ? prev[idx] : ({} as ConversationWithContact)),
        ...conv,
        contact: contact ?? prev[idx]?.contact,
      };
      if (idx >= 0) next[idx] = merged;
      else next.unshift(merged);
      return next.sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );
    });

    if (isNewWaiting) {
      playNotificationPing(); // "ding" de novo atendimento
      if (document.visibilityState !== "visible") {
        unseen.current += 1;
        document.title = `(${unseen.current}) 🔔 Novo atendimento — ${baseTitle.current}`;
      }
    }
  }, [fetchContact]);

  useInboxRealtime({
    supabase,
    onInsert: upsert,
    onUpdate: upsert,
  });

  const waiting = items.filter((c) => c.status === "waiting");
  const inProgress = items.filter((c) => c.status === "in_progress");
  const closed = items.filter((c) => c.status === "closed");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Inbox</h1>
          <p className="text-xs text-muted-foreground">
            Atendimentos em tempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="warning"><CircleDot className="mr-1 h-3 w-3" />{waiting.length} aguardando</Badge>
          <Badge variant="success">{inProgress.length} em atendimento</Badge>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ConversationStatus)} className="h-full flex flex-col">
          <TabsList>
            <TabsTrigger value="waiting">Aguardando ({waiting.length})</TabsTrigger>
            <TabsTrigger value="in_progress">Em atendimento ({inProgress.length})</TabsTrigger>
            <TabsTrigger value="closed">Concluídos ({closed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="waiting" className="flex-1 overflow-auto scroll-thin mt-3">
            <List items={waiting} emptyLabel="Sem ninguém aguardando." />
          </TabsContent>
          <TabsContent value="in_progress" className="flex-1 overflow-auto scroll-thin mt-3">
            <List items={inProgress} emptyLabel="Nenhum atendimento ativo." />
          </TabsContent>
          <TabsContent value="closed" className="flex-1 overflow-auto scroll-thin mt-3">
            <List items={closed} emptyLabel="Sem conversas concluídas." />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function List({ items, emptyLabel }: { items: ConversationWithContact[]; emptyLabel: string }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/conversations/${c.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-accent/40 transition-colors",
            )}
          >
            <Avatar>
              <AvatarFallback>{getInitials(c.contact?.name ?? c.contact?.email)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{c.contact?.name || c.contact?.email}</span>
                <StatusPill status={c.status} />
              </div>
              <div className="text-xs text-muted-foreground truncate">{c.contact?.email}</div>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ptBR })}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatusPill({ status }: { status: ConversationStatus }) {
  if (status === "waiting") return <Badge variant="warning">Aguardando</Badge>;
  if (status === "in_progress") return <Badge variant="success"><CircleDot className="mr-1 h-3 w-3" />Em atendimento</Badge>;
  return <Badge variant="muted"><CheckCircle2 className="mr-1 h-3 w-3" />Concluído</Badge>;
}
