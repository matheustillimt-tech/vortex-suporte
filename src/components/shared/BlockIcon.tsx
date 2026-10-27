"use client";

import { ACCENTS, getIcon } from "@/lib/widget-meta";
import { cn } from "@/lib/utils";
import type { BlockAccent } from "@/lib/supabase/types";

type Props = {
  iconName: string;
  iconUrl?: string | null;
  accent: BlockAccent;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: { wrap: "h-8 w-8", icon: "h-3.5 w-3.5", img: "h-7 w-7" },
  md: { wrap: "h-10 w-10", icon: "h-4 w-4",    img: "h-9 w-9" },
  lg: { wrap: "h-12 w-12", icon: "h-5 w-5",    img: "h-11 w-11" },
};

/**
 * Renderiza um ícone de bloco da Home.
 * - Se iconUrl está setada → mostra a imagem (PNG sem fundo, etc.)
 * - Senão → mostra o ícone Lucide pelo nome, com background do accent escolhido
 */
export function BlockIcon({ iconName, iconUrl, accent, size = "md", className }: Props) {
  const s = SIZES[size];

  // Custom image: sem background (imagem é o ícone inteiro)
  if (iconUrl) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center", s.wrap, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" className={cn("object-contain", s.img)} />
      </div>
    );
  }

  // Lucide: com background colorido do accent
  const Icon = getIcon(iconName);
  const ac = ACCENTS[accent];
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full", s.wrap, ac.bg, ac.text, className)}>
      <Icon className={s.icon} />
    </div>
  );
}
