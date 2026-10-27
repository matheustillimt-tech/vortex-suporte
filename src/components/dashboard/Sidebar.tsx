"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/shared/Logo";
import {
  BarChart3, Bug, Building2, ChevronLeft, ChevronRight, Code, Eye, Inbox, LogOut,
  type LucideIcon, MessageCircle, PanelLeft, Users, Lightbulb,
  Bell, Wrench, Clock, Megaphone, Zap, Tag,
} from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

type Item = { href: string; icon: LucideIcon; label: string; section?: string };

type Agent = { name: string; email: string; role: "agent" | "admin" };

const STORAGE_KEY = "dashboard.sidebar.collapsed";

type SidebarProps = {
  agent: Agent;
  /** Quando passado, sobrescreve o localStorage e força modo expandido (uso mobile drawer). */
  forceExpanded?: boolean;
  /** Chamado ao clicar em qualquer item — usado pra fechar o drawer mobile. */
  onItemClick?: () => void;
};

export function Sidebar({ agent, forceExpanded, onItemClick }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  const effectiveCollapsed = forceExpanded ? false : collapsed;

  // hidrata do localStorage só no client (evita mismatch SSR)
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* */ }
      return next;
    });
  }

  const isAdmin = agent.role === "admin";

  const items: Item[] = [
    ...(isAdmin ? [{ href: "/admin/dashboard", icon: BarChart3, label: "Dashboard" }] : []),
    { href: "/inbox", icon: Inbox, label: "Inbox" },
    { href: "/admin/bugs", icon: Bug, label: "Bug reports" },
    { href: "/respostas-rapidas", icon: Zap, label: "Respostas rápidas", section: "Ferramentas" },
    ...(isAdmin
      ? [
          { href: "/admin/agents", icon: Users, label: "Agentes", section: "Administração" },
          { href: "/admin/departments", icon: Building2, label: "Departamentos" },
          { href: "/admin/close-reasons", icon: Tag, label: "Motivos de finalização" },
        ]
      : []),
    ...(isAdmin
      ? [
          { href: "/admin/widget", icon: Wrench, label: "Configurações do widget", section: "Widget" },
          { href: "/admin/widget/preview", icon: Eye, label: "Preview" },
          { href: "/admin/widget/topics", icon: Lightbulb, label: "Temas / Roteamento" },
          { href: "/admin/widget/blocks", icon: MessageCircle, label: "Blocos da Home" },
          { href: "/admin/widget/updates", icon: Megaphone, label: "Atualizações" },
          { href: "/admin/widget/suggestions", icon: Bell, label: "Sugestões" },
          { href: "/admin/widget/hours", icon: Clock, label: "Horário de atendimento" },
          { href: "/admin/install", icon: Code, label: "Instalação" },
        ]
      : []),
  ];

  return (
    <aside
      data-collapsed={effectiveCollapsed}
      className={cn(
        "group/sidebar relative flex h-full shrink-0 flex-col border-r border-border/50 bg-card transition-[width] duration-200 ease-out",
        effectiveCollapsed ? "w-[68px]" : "w-60",
      )}
    >
      {/* Header com logo */}
      <div className={cn(
        "flex items-center border-b border-border/50",
        effectiveCollapsed ? "h-14 justify-center" : "h-14 px-4",
      )}>
        <Link href="/inbox" onClick={onItemClick} className="flex items-center gap-2.5 overflow-hidden">
          <BrandLogo size={28} />
          {!effectiveCollapsed && (
            <span className="whitespace-nowrap text-sm font-semibold tracking-tight">
              {BRAND.name} <span className="text-muted-foreground font-normal">Suporte</span>
            </span>
          )}
        </Link>
      </div>

      {/* Botão collapse — só faz sentido na sidebar desktop */}
      {!forceExpanded && (
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "absolute -right-3 top-4 z-10 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all",
            "hover:text-foreground hover:border-primary/40 hover:bg-secondary",
            mounted ? "opacity-100" : "opacity-0",
          )}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden scroll-thin px-2 py-2">
        <NavItems items={items} pathname={pathname} collapsed={effectiveCollapsed} onItemClick={onItemClick} />
      </nav>

      {/* Footer: avatar + logout */}
      <div className="border-t border-border/50 p-2 space-y-2">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2 py-1.5",
            effectiveCollapsed && "justify-center",
          )}
          title={effectiveCollapsed ? `${agent.name} (${agent.email})` : undefined}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">
              {getInitials(agent.name)}
            </AvatarFallback>
          </Avatar>
          {!effectiveCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{agent.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{agent.email}</div>
            </div>
          )}
        </div>

        {effectiveCollapsed ? (
          <LogoutButton
            className="!w-full justify-center !px-0 py-2 text-xs"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </LogoutButton>
        ) : (
          <LogoutButton className="px-3 py-2 text-xs">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </LogoutButton>
        )}
      </div>
    </aside>
  );
}

function NavItems({
  items, pathname, collapsed, onItemClick,
}: { items: Item[]; pathname: string; collapsed: boolean; onItemClick?: () => void }) {
  // Agrupa por section
  const groups: { name: string | undefined; items: Item[] }[] = [];
  for (const it of items) {
    if (it.section) {
      groups.push({ name: it.section, items: [it] });
    } else if (groups.length > 0 && !groups[groups.length - 1].name) {
      groups[groups.length - 1].items.push(it);
    } else {
      const last = groups[groups.length - 1];
      if (last && last.items.length > 0 && !it.section) last.items.push(it);
      else groups.push({ name: undefined, items: [it] });
    }
  }
  // Ajuste: cada item subsequente sem section deve cair no último grupo
  const final: typeof groups = [];
  for (const it of items) {
    if (it.section) {
      final.push({ name: it.section, items: [it] });
    } else {
      const last = final[final.length - 1];
      if (last) last.items.push(it);
      else final.push({ name: undefined, items: [it] });
    }
  }

  return (
    <div className="space-y-1">
      {final.map((g, gi) => (
        <div key={gi} className={cn(gi > 0 && "mt-4")}>
          {g.name && !collapsed && (
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.name}
            </div>
          )}
          {g.name && collapsed && (
            <div className="my-2 mx-2 h-px bg-border/40" aria-hidden />
          )}
          {g.items.map((it) => {
            const Icon = it.icon;
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onItemClick}
                title={collapsed ? it.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md text-[13.5px] transition-colors",
                  collapsed ? "h-10 w-full justify-center px-0" : "px-3 py-2.5",
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-foreground/85 hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export { PanelLeft }; // re-export caso useful
