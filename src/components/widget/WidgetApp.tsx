"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConversationBroadcast } from "@/lib/realtime/useConversationBroadcast";
import { useConversationPolling } from "@/lib/realtime/useConversationPolling";
import { useQueuePosition } from "@/lib/realtime/useQueuePosition";
import { WidgetHeader } from "./WidgetHeader";
import { WidgetTabs, type WidgetTab } from "./WidgetTabs";
import { Home } from "./Home";
import { IdentifyStep } from "./IdentifyStep";
import { QueueView } from "./QueueView";
import { ChatPanel } from "./ChatPanel";
import { Updates } from "./Updates";
import { Suggestions } from "./Suggestions";
import { OfflineNotice, type ScheduleSlot } from "./OfflineNotice";
import { TopicPicker } from "./TopicPicker";
import { BugReportForm } from "./BugReportForm";
import type {
  Conversation, HomeBlock, Message, SupportTopic, WidgetSettings,
} from "@/lib/supabase/types";
import { PROJECT_KEY } from "@/lib/widget-project";
import { hexToHslTriplet, normalizeHex } from "@/lib/brand";

type IdentifyPayload = {
  email: string;
  name?: string | null;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
  userId?: string | null;
  userHash?: string | null;
};

type SessionState = {
  contactId: string;
  name: string | null;
  sessionToken: string;
  activeConversationId: string | null;
};


// Visitante sem login (site que não chamou identify()): um id aleatório guardado
// neste navegador. O servidor nunca junta visitante com cliente pelo e-mail.
function visitorExternalId(): string {
  const key = "vortex-suporte-visitante";
  try {
    const saved = localStorage.getItem(key);
    if (saved && saved.startsWith("visitante:")) return saved;
    const id = `visitante:${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `visitante:${crypto.randomUUID()}`;
  }
}

type Config = {
  settings: (WidgetSettings & { topic_picker_enabled?: boolean }) | null;
  blocks: HomeBlock[];
  isOnline: boolean;
  topics: SupportTopic[];
  nextOpenLabel?: string | null;
  schedule?: ScheduleSlot[];
};

export function WidgetApp() {
  const supabase = useMemo(() => createClient(), []);
  const [config, setConfig] = useState<Config | null>(null);
  const [tab, setTab] = useState<WidgetTab>("home");
  const [identity, setIdentity] = useState<IdentifyPayload | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [bugContext, setBugContext] = useState<string | null>(null);
  const [pickedTopic, setPickedTopic] = useState<SupportTopic | null>(null);
  // Modo "report bug" mostra o BugReportForm em vez de criar conversa
  const [bugReportMode, setBugReportMode] = useState(false);
  // Estado de visibilidade do widget (controlado pelo SDK via postMessage)
  const [widgetOpen, setWidgetOpen] = useState(false);
  // Mensagens não vistas — incrementa quando agente envia e widget está fechado/fora da aba chat
  const [unreadCount, setUnreadCount] = useState(0);
  const sentReady = useRef(false);
  const seenMessageIds = useRef(new Set<string>());
  const [pageVisible, setPageVisible] = useState(true);

  // 1) Busca config inicial (settings + blocks + is_online)
  useEffect(() => {
    fetch(`/api/widget/config?project=${PROJECT_KEY}`)
      .then((r) => r.json())
      .then((d: Config) => setConfig(d))
      .catch(() => setConfig({ settings: null, blocks: [], isOnline: true, topics: [] }));
  }, []);

  // 1b) Cor da marca definida no painel: aplica no widget e avisa o botão
  //     flutuante (widget.js) pra usar a mesma cor.
  useEffect(() => {
    const color = normalizeHex(config?.settings?.brand_color);
    if (!color) return;
    const hsl = hexToHslTriplet(color);
    const root = document.documentElement;
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--brand", hsl);
    if (window.parent !== window) window.parent.postMessage({ type: "brand", color }, "*");
  }, [config?.settings?.brand_color]);

  // 2) Recebe identidade do parent via postMessage (ou query string em dev).
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.source !== window.parent) return;
      const msg = e.data as { type?: string; payload?: IdentifyPayload; visible?: boolean };
      if (msg?.type === "identify" && msg.payload?.email) {
        setIdentity(msg.payload);
      } else if (msg?.type === "open-chat") {
        setTab("chat");
      } else if (msg?.type === "widget-opened") {
        setWidgetOpen(true);
      } else if (msg?.type === "page-visibility") {
        setPageVisible(msg.visible !== false);
      } else if (msg?.type === "widget-closed") {
        setWidgetOpen(false);
      } else if (msg?.type === "reset") {
        setIdentity(null); setSession(null); setConv(null); setMessages([]); setTab("home");
        setUnreadCount(0);
        seenMessageIds.current.clear();
      }
    }
    window.addEventListener("message", handler);

    if (!sentReady.current && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const email = url.searchParams.get("email");
      if (email && !identity) {
        setIdentity({
          email,
          name: url.searchParams.get("name"),
          externalId: url.searchParams.get("uid"),
        });
      }
    }
    if (!sentReady.current) {
      sentReady.current = true;
      window.parent.postMessage({ type: "ready" }, "*");
    }
    return () => window.removeEventListener("message", handler);
  }, [identity]);

  // 3) Quando temos identidade, chama /api/identify.
  useEffect(() => {
    if (!identity || session) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectKey: PROJECT_KEY,
          email: identity.email,
          name: identity.name,
          externalId: identity.externalId ?? identity.userId ?? null,
          metadata: identity.metadata ?? {},
          userHash: identity.userHash ?? undefined,
        }),
      });
      if (!res.ok || cancelled) return;
      const data = await res.json() as {
        contactId: string; name: string | null; sessionToken: string;
        activeConversation: { id: string } | null;
      };
      setSession({
        contactId: data.contactId,
        name: data.name,
        sessionToken: data.sessionToken,
        activeConversationId: data.activeConversation?.id ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [identity, session]);

  // 4) Carrega/cria conversa quando entra em Chat
  //    Só cria se: já temos identidade + (não há topics OU já escolheu OU já tem conversa ativa)
  useEffect(() => {
    if (!session || !session.name || (tab !== "chat" && !session.activeConversationId)) return;
    // Fora do horário, permite retomar o histórico existente. Novos
    // contatos continuam vendo o aviso sem criar atendimento na fila.
    if (config && !config.isOnline && !session.activeConversationId && !conv) return;

    const hasActiveConvAlready = !!session.activeConversationId;
    const topicsAvailable =
      (config?.settings?.topic_picker_enabled ?? true) && (config?.topics?.length ?? 0) > 0;
    const needsPick = topicsAvailable && !pickedTopic && !hasActiveConvAlready;

    if (needsPick) return; // espera o usuário escolher tema
    if (conv) return;       // já carregou

    // Só carrega (ou cria, no primeiro contato). Nunca reabre: atendimento
    // encerrado volta pra fila só quando o cliente envia uma mensagem.
    void ensureConversation(undefined, undefined, pickedTopic?.id || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, session, config, pickedTopic, conv]);

  const loadConversation = useCallback(async (
    contactName?: string,
    prefillBody?: string,
    topicId?: string,
  ) => {
    if (!session) return;
    setLoadingConv(true);
    const body: Record<string, string> = {};
    if (contactName) body.contactName = contactName;
    if (topicId) body.topicId = topicId;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${session.sessionToken}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json() as { conversation: Conversation };
      const m = await fetch(`/api/conversations?id=${data.conversation.id}`, {
        headers: { authorization: `Bearer ${session.sessionToken}` },
      });
      if (m.ok) {
        const md = await m.json() as { messages: Message[] };
        for (const message of md.messages) seenMessageIds.current.add(message.id);
        setMessages(md.messages);
        try {
          const key = `support-last-read:${session.contactId}`;
          const saved = sessionStorage.getItem(key);
          if (saved) setUnreadCount(md.messages.filter(m => m.author_type === "agent" && !m.deleted_at && Date.parse(m.created_at) > Number(saved)).length);
          else sessionStorage.setItem(key, String(Date.now()));
        } catch { /* armazenamento indisponível: notificações da sessão continuam */ }
      }
      if (!m.ok) { setLoadingConv(false); return; }
      setConv(data.conversation);
      // Envia mensagem inicial com contexto de bug, se aplicável.
      if (prefillBody) {
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${session.sessionToken}` },
          body: JSON.stringify({ conversationId: data.conversation.id, body: prefillBody }),
        });
      }
    }
    setLoadingConv(false);
  }, [session]);

  // Uma carga por vez: escolher o tema (ou se identificar) mexe no estado que
  // o efeito acima observa e disparava um segundo POST idêntico ao do clique.
  // Com mensagem inicial (contexto de bug), espera a carga em curso e roda
  // depois, pra não perder a mensagem.
  const ensuring = useRef<Promise<void> | null>(null);
  const ensureConversation = useCallback((
    contactName?: string,
    prefillBody?: string,
    topicId?: string,
  ) => {
    if (!session) return Promise.resolve();
    const inFlight = ensuring.current;
    if (inFlight && !prefillBody) return inFlight;
    const run: Promise<void> = (inFlight ?? Promise.resolve())
      .then(() => loadConversation(contactName, prefillBody, topicId))
      .finally(() => { if (ensuring.current === run) ensuring.current = null; });
    ensuring.current = run;
    return run;
  }, [session, loadConversation]);

  // Handler centralizado de mensagem nova — faz dedup E controla notificações
  const handleIncomingMessage = useCallback((msg: Message) => {
    if (seenMessageIds.current.has(msg.id)) return;
    seenMessageIds.current.add(msg.id);
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });

    // Notificação: só pra mensagens de AGENTE (não system, bot, contato).
    // E só se o widget está fechado OU o cliente não está na aba chat.
    const shouldNotify = msg.author_type === "agent";
    const isVisible = widgetOpen && tab === "chat" && pageVisible;
    if (shouldNotify && !isVisible) {
      setUnreadCount(c => c + 1);
    }
  }, [widgetOpen, tab, pageVisible]);

  // Reset do contador quando o widget abrir e estiver na aba chat
  useEffect(() => {
    if (widgetOpen && tab === "chat" && pageVisible) {
      setUnreadCount(0);
      if (session) try { sessionStorage.setItem(`support-last-read:${session.contactId}`, String(Date.now())); } catch {}
    }
  }, [widgetOpen, tab, pageVisible, messages.length, session]);

  // Avisa o SDK (parent) sempre que o contador muda
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.parent.postMessage({ type: "unread", count: unreadCount }, "*");
  }, [unreadCount]);

  // Patch local pra updates de mensagem (edit/delete) — usado por ambos
  // realtime e callback do composer/bubble.
  const patchMessageLocal = useCallback((upd: Partial<Message> & { id: string }) => {
    setMessages((prev) => prev.map((m) => (m.id === upd.id ? { ...m, ...upd } : m)));
  }, []);

  // Realtime Broadcast — instantâneo quando funciona (depende de config Supabase)
  useConversationBroadcast({
    supabase,
    conversationId: conv?.id ?? null,
    onMessage: handleIncomingMessage,
    onMessageUpdate: patchMessageLocal,
    onConversation: (update) => setConv((prev) => (prev ? { ...prev, ...update } : prev)),
  });

  // Polling — backup robusto, roda mesmo com widget fechado pra capturar
  // mensagens em background e atualizar o badge de unread.
  useConversationPolling({
    enabled: !!conv && !!session?.sessionToken,
    conversationId: conv?.id ?? null,
    sessionToken: session?.sessionToken ?? null,
    intervalMs: 3000,
    onMessage: handleIncomingMessage,
    onMessageUpdate: patchMessageLocal,
    onConversation: (update) => setConv((prev) => (prev ? { ...prev, ...update } : prev)),
  });

  const queue = useQueuePosition({
    enabled: tab === "chat" && conv?.status === "waiting",
    conversationId: conv?.id ?? null,
    sessionToken: session?.sessionToken ?? null,
    intervalMs: 3000,
  });

  // Handler unificado das ações dos blocos da Home
  const handleBlockAction = useCallback(
    (block: HomeBlock) => {
      switch (block.action_type) {
        case "open_chat":
          setTab("chat");
          return;
        case "open_url":
          if (block.action_value) {
            window.open(block.action_value, "_blank", "noopener,noreferrer");
          }
          return;
        case "switch_tab":
          if (block.action_value) setTab(block.action_value as WidgetTab);
          return;
        case "report_bug":
          // Bug reports NÃO entram no inbox de suporte.
          // Abre o BugReportForm — vai pra tabela bug_reports separada.
          {
            const ctx = [
              identity?.metadata && Object.keys(identity.metadata).length > 0
                ? `Metadata do usuário: ${JSON.stringify(identity.metadata)}`
                : null,
            ].filter(Boolean).join("\n");
            setBugContext(ctx);
            setBugReportMode(true);
          }
          return;
      }
    },
    [identity],
  );

  // Bug reports NÃO criam conversa — vão pra entidade própria via BugReportForm.
  // Mantemos o useEffect só pra retrocompatibilidade caso bugContext seja setado
  // por outro fluxo legado, mas hoje só BugReportForm consome.
  useEffect(() => {
    if (!bugContext || bugReportMode || tab !== "chat" || !session || !session.name) return;
    void (async () => {
      await ensureConversation(undefined, bugContext);
      setBugContext(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugContext, tab, session]);

  // O aviso substitui o chat somente para quem ainda não tem atendimento.
  // Conversas existentes continuam acessíveis após o encerramento do horário.
  const isOffline = !!config && !config.isOnline && !session?.activeConversationId && !conv;
  const needsIdentify = tab === "chat" && !isOffline && session && !session.name;
  const topicsAvailable =
    (config?.settings?.topic_picker_enabled ?? true) && (config?.topics?.length ?? 0) > 0;
  const needsTopicPick =
    tab === "chat" &&
    !isOffline &&
    !!session &&
    !!session.name &&
    topicsAvailable &&
    !pickedTopic &&
    !session.activeConversationId &&
    !conv;
  const visibleTabs: WidgetTab[] = useMemo(() => {
    const s = config?.settings;
    const tabs: WidgetTab[] = [];
    if (!s || s.show_home) tabs.push("home");
    if (!s || s.show_chat) tabs.push("chat");
    if (!s || s.show_updates) tabs.push("updates");
    if (!s || s.show_suggestions) tabs.push("ideas");
    return tabs;
  }, [config]);

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <WidgetHeader onClose={() => window.parent.postMessage({ type: "requestClose" }, "*")} />

      <div className="flex-1 overflow-hidden">
        {/* Bug report mode — overlay sobre tudo */}
        {bugReportMode && session?.sessionToken && (
          <BugReportForm
            sessionToken={session.sessionToken}
            initialContext={bugContext ?? ""}
            onDone={() => { setBugReportMode(false); setBugContext(null); setTab("home"); }}
          />
        )}

        {!bugReportMode && tab === "home" && (
          <Home
            greetingTitle={config.settings?.greeting_title ?? "Olá 👋"}
            greetingSubtitle={config.settings?.greeting_subtitle ?? "Como podemos ajudar você hoje?"}
            blocks={config.blocks}
            onAction={handleBlockAction}
          />
        )}

        {!bugReportMode && tab === "chat" && isOffline && (
          <OfflineNotice
            message={config.settings?.offline_message
              ?? "No momento estamos fora do horário de atendimento."}
            nextOpenLabel={config.nextOpenLabel}
            schedule={config.schedule}
          />
        )}

        {!bugReportMode && tab === "chat" && !isOffline && !session && identity && (
          <div className="p-8 text-center text-sm text-muted-foreground">Conectando…</div>
        )}

        {/* Site sem login (não chamou identify): pede nome e e-mail e entra como visitante */}
        {!bugReportMode && tab === "chat" && !isOffline && !session && !identity && (
          <IdentifyStep
            initialEmail=""
            initialName=""
            onSubmit={async (vals) => {
              setIdentity({
                email: vals.email,
                name: vals.name,
                externalId: visitorExternalId(),
                metadata: { visitante: true, origem: "widget" },
              });
            }}
          />
        )}

        {!bugReportMode && tab === "chat" && needsIdentify && (
          <IdentifyStep
            initialEmail={identity?.email ?? ""}
            initialName={session?.name ?? identity?.name ?? ""}
            onSubmit={async (vals) => {
              setSession((prev) => (prev ? { ...prev, name: vals.name } : prev));
              await ensureConversation(vals.name);
            }}
          />
        )}

        {!bugReportMode && tab === "chat" && needsTopicPick && (
          <TopicPicker
            topics={config!.topics}
            onPick={(t) => {
              setPickedTopic(t);
              void ensureConversation(undefined, undefined, t.id);
            }}
            onSkip={() => {
              setPickedTopic({ id: "" } as SupportTopic);
              void ensureConversation();
            }}
          />
        )}

        {!bugReportMode && tab === "chat" && !isOffline && session && session.name && !needsTopicPick && (
          loadingConv && !conv ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando atendimento…</div>
          ) : conv ? (
            <ChatPanel
              conv={conv}
              messages={messages}
              contactId={session.contactId}
              sessionToken={session.sessionToken}
              onSent={handleIncomingMessage}
              onMessagePatched={patchMessageLocal}
              queue={conv.status === "waiting" ? queue : null}
              topicId={pickedTopic?.id || undefined}
            />
          ) : null
        )}

        {tab === "updates" && <Updates projectKey={PROJECT_KEY} />}
        {tab === "ideas" && (
          <Suggestions
            projectKey={PROJECT_KEY}
            sessionToken={session?.sessionToken ?? null}
          />
        )}
      </div>

      <WidgetTabs value={tab} onChange={setTab} visible={visibleTabs} />
    </div>
  );
}
