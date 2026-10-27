"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

type Agent = { name: string; email: string; role: "agent" | "admin" };

/**
 * Wrapper que aplica:
 *  - Sidebar desktop normal (md+)
 *  - Top bar com hamburger + sidebar como overlay (< md)
 *
 * O conteúdo (children) fica no <main>.
 */
export function MobileShell({ agent, children }: { agent: Agent; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Fecha o drawer quando navegação acontece
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Bloqueia scroll do body quando drawer aberto
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  return (
    <div className="panel-theme flex h-dvh bg-background text-foreground">
      {/* Sidebar desktop — sempre visível em md+ */}
      <div className="hidden md:flex">
        <Sidebar agent={agent} />
      </div>

      {/* Drawer mobile */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
          />
          <div className="fixed left-0 top-0 bottom-0 z-50 md:hidden animate-in slide-in-from-left duration-200">
            <Sidebar agent={agent} onItemClick={() => setOpen(false)} forceExpanded />
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar mobile (md:hidden) */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 bg-card px-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo size={22} />
        </header>

        <main className={cn("flex-1 overflow-hidden")}>{children}</main>
      </div>
    </div>
  );
}
