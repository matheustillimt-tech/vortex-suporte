"use client";

import { ArrowRight } from "lucide-react";
import { BlockIcon } from "@/components/shared/BlockIcon";
import { BRAND } from "@/lib/brand";
import type { HomeBlock } from "@/lib/supabase/types";

type Props = {
  greetingTitle: string;
  greetingSubtitle: string;
  blocks: HomeBlock[];
  onAction: (b: HomeBlock) => void;
};

export function Home({ greetingTitle, greetingSubtitle, blocks, onAction }: Props) {
  return (
    <div className="flex h-full flex-col overflow-auto scroll-thin">
      <div className="relative overflow-hidden px-6 pt-8 pb-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 20% 0%, hsl(var(--primary) / 0.20), transparent 60%)",
          }}
        />
        <div className="relative space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">{greetingTitle}</h2>
          <p className="text-sm text-muted-foreground">{greetingSubtitle}</p>
        </div>
      </div>

      <div className="space-y-2 px-4 pb-4">
        {blocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-6 text-center text-xs text-muted-foreground">
            Nenhum bloco configurado ainda. Configure em <span className="font-mono">/admin/widget/blocks</span>.
          </div>
        ) : (
          blocks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onAction(b)}
              className="group flex w-full items-center justify-between rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <BlockIcon iconName={b.icon} iconUrl={b.icon_url} accent={b.accent} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{b.title}</div>
                  {b.description && <div className="text-xs text-muted-foreground truncate">{b.description}</div>}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          ))
        )}
      </div>

      <div className="mt-auto px-6 py-4 text-center text-[11px] text-muted-foreground/80">
        Suporte oficial {BRAND.name}
      </div>
    </div>
  );
}
