"use client";

import { BrandLogo } from "@/components/shared/Logo";
import { SUPPORT_TITLE } from "@/lib/brand";
import { X } from "lucide-react";

export function WidgetHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="relative overflow-hidden border-b border-border/60 bg-card px-4 py-3">
      {/* Faixa fina na cor da marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary)) 100%)" }}
      />
      {/* Glow sutil da marca atrás do conteúdo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 0% 0%, hsl(var(--primary) / 0.15), transparent 60%)",
        }}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={28} />
          <div>
            <div className="text-sm font-semibold leading-tight">{SUPPORT_TITLE}</div>
            <div className="text-[11px] text-muted-foreground">
              Geralmente respondemos em poucos minutos
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
