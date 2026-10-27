"use client";

import { Home, MessageCircle, Bell, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type WidgetTab = "home" | "chat" | "updates" | "ideas";

const TAB_META: Record<WidgetTab, { label: string; Icon: LucideIcon }> = {
  home:    { label: "Início",       Icon: Home },
  chat:    { label: "Chat",          Icon: MessageCircle },
  updates: { label: "Atualizações",  Icon: Bell },
  ideas:   { label: "Sugestões",     Icon: Lightbulb },
};

export function WidgetTabs({
  value, onChange, visible = ["home", "chat", "updates", "ideas"],
}: {
  value: WidgetTab;
  onChange: (v: WidgetTab) => void;
  visible?: WidgetTab[];
}) {
  if (visible.length === 0) return null;
  return (
    <nav
      className="grid border-t border-border/60 bg-card"
      style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
    >
      {visible.map((id) => {
        const { label, Icon } = TAB_META[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
