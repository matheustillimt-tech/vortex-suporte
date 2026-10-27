"use client";

import { BrandLogo } from "@/components/shared/Logo";
import { BlockIcon } from "@/components/shared/BlockIcon";
import type { SupportTopic } from "@/lib/supabase/types";

type Props = {
  topics: SupportTopic[];
  onPick: (t: SupportTopic) => void;
  onSkip: () => void;
};

export function TopicPicker({ topics, onPick, onSkip }: Props) {
  return (
    <div className="flex h-full flex-col overflow-auto scroll-thin">
      {/* "Bot greeting" */}
      <div className="flex gap-2.5 px-4 pt-4">
        <div className="shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <BrandLogo size={22} className="rounded-sm" />
          </div>
        </div>
        <div className="space-y-2 flex-1">
          <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
            Olá! Pra te direcionar pro time certo, sobre <span className="font-semibold">qual assunto</span> você precisa de ajuda?
          </div>
        </div>
      </div>

      {/* Opções de tema */}
      <div className="space-y-1.5 px-4 pt-3 pb-2">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
          >
            <BlockIcon iconName={t.icon} iconUrl={t.icon_url} accent="primary" size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{t.name}</div>
              {t.description && (
                <div className="text-[12px] text-muted-foreground truncate">{t.description}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="border-t border-border/40 px-4 py-3 mt-auto">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Outro assunto / não sei
        </button>
      </div>
    </div>
  );
}
