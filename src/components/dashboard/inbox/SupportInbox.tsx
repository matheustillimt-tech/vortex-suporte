"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConversationList } from "./ConversationList";
import { ChatPane } from "./ChatPane";
import { EmptyChatState } from "./EmptyChatState";
import { ContactPanel } from "./ContactPanel";
import { cn } from "@/lib/utils";
import type { Agent, Contact, ConversationWithContact } from "@/lib/supabase/types";

type Props = {
  agent: Pick<Agent, "id" | "name" | "email" | "role">;
  initial: ConversationWithContact[];
};

export function SupportInbox(props: Props) {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando…</div>}>
      <Inner {...props} />
    </Suspense>
  );
}

type FilterTab = "waiting" | "in_progress" | "closed";

function isValidTab(v: string | null): v is FilterTab {
  return v === "waiting" || v === "in_progress" || v === "closed";
}

function Inner({ agent, initial }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const selectedId = search.get("c");
  const showContact = search.get("panel") === "contact";
  const tabFromUrl = search.get("tab");
  const tab: FilterTab = isValidTab(tabFromUrl) ? tabFromUrl : "waiting";

  // Memoiza conv + contact da conversa selecionada (vem direto do cache da lista)
  const selectedConv = useMemo(
    () => (selectedId ? initial.find((c) => c.id === selectedId) ?? null : null),
    [initial, selectedId],
  );
  const selectedContactId = selectedConv?.contact_id ?? null;
  const selectedContact: Contact | null = selectedConv?.contact ?? null;

  // Sync se a conv mudar via realtime
  const [contactId, setContactId] = useState<string | null>(selectedContactId);
  useEffect(() => setContactId(selectedContactId), [selectedContactId]);

  const handleSelect = useCallback(
    (id: string) => {
      const params = new URLSearchParams(search.toString());
      params.set("c", id);
      router.replace(`/inbox?${params.toString()}`, { scroll: false });
    },
    [router, search],
  );

  const handleTabChange = useCallback(
    (next: FilterTab) => {
      const params = new URLSearchParams(search.toString());
      params.set("tab", next);
      router.replace(`/inbox?${params.toString()}`, { scroll: false });
    },
    [router, search],
  );

  // Chamado pelo ChatPane quando o status da conversa muda — alinha a aba
  // visível com o novo status, mantendo a conversa selecionada.
  const handleStatusChanged = useCallback(
    (newStatus: FilterTab) => {
      const params = new URLSearchParams(search.toString());
      params.set("tab", newStatus);
      // mantém ?c= (conversa selecionada)
      router.replace(`/inbox?${params.toString()}`, { scroll: false });
    },
    [router, search],
  );

  const handleBackToList = useCallback(() => {
    // Mantém o tab atual; só limpa a conversa selecionada e painel.
    const params = new URLSearchParams();
    if (tabFromUrl) params.set("tab", tabFromUrl);
    router.replace(`/inbox${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [router, tabFromUrl]);

  const toggleContact = useCallback(() => {
    const params = new URLSearchParams(search.toString());
    if (showContact) params.delete("panel");
    else params.set("panel", "contact");
    router.replace(`/inbox?${params.toString()}`, { scroll: false });
  }, [router, search, showContact]);

  // Layout:
  //  Desktop (md+):  [Lista 360px] [Chat flex] [Contato 320px slide]
  //  Mobile (< md):  uma view por vez — list OU chat OU contato
  //                  (controlado por presença de ?c= e ?panel=)
  const mobileShowing = showContact && selectedId
    ? "contact"
    : selectedId
    ? "chat"
    : "list";

  return (
    <div className="flex h-full">
      {/* Lista — sempre visível em md+; em mobile só quando nada está selecionado */}
      <div
        className={
          mobileShowing === "list"
            ? "flex w-full md:w-[360px] md:shrink-0 md:border-r md:border-border/50"
            : "hidden md:flex md:w-[360px] md:shrink-0 md:border-r md:border-border/50"
        }
      >
        <ConversationList
          initial={initial}
          selectedId={selectedId}
          onSelect={handleSelect}
          tab={tab}
          onTabChange={handleTabChange}
          onDeleted={(deletedId) => {
            // Se a conversa apagada era a selecionada → sai dela
            if (deletedId === selectedId) {
              const params = new URLSearchParams();
              if (tabFromUrl) params.set("tab", tabFromUrl);
              router.replace(`/inbox${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
            }
          }}
        />
      </div>

      {/* Chat — visível em md+ sempre; em mobile quando há conv selecionada e não está no contato */}
      <div
        className={
          mobileShowing === "chat"
            ? "flex flex-1 min-w-0"
            : "hidden md:flex md:flex-1 md:min-w-0"
        }
      >
        {selectedId ? (
          <ChatPane
            key={selectedId}
            conversationId={selectedId}
            agent={agent}
            onOpenContact={toggleContact}
            onBack={handleBackToList}
            onStatusChanged={handleStatusChanged}
            contactPanelOpen={showContact}
          />
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* Contato:
            - Mobile: full-screen overlay (fixed) quando mobileShowing === "contact"
            - Desktop: lateral 320px, sempre que showContact && selectedId */}
      {selectedId && showContact && contactId && (
        <div
          className={cn(
            // Mobile: overlay
            mobileShowing === "contact"
              ? "fixed inset-0 z-40 flex"
              : "hidden",
            // Desktop: side panel
            "md:static md:z-auto md:flex md:w-80 md:shrink-0",
          )}
        >
          <ContactPanel
            key={contactId}
            contactId={contactId}
            conversationId={selectedId}
            initialContact={selectedContact}
            agent={agent}
            onClose={toggleContact}
            onConversationDeleted={() => router.replace("/inbox")}
          />
        </div>
      )}
    </div>
  );
}
