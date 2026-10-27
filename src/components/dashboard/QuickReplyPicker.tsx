"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, ImageIcon, Loader2, Search, Video, Volume2, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Attachment, QuickReply } from "@/lib/supabase/types";

type Props = {
  /** Chamado quando o atendente escolhe uma resposta — pai injeta no composer. */
  onPick: (body: string, attachments: Attachment[]) => void;
  /** Abrir controlado pelo pai (ex.: ao digitar "/" no composer). Se omitido, usa estado interno (botão). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function attIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Volume2;
  return FileText;
}

export function QuickReplyPicker({ onPick, open: openProp, onOpenChange }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [openInternal, setOpenInternal] = useState(false);
  // Híbrido: se o pai controla (openProp definido), usa ele; senão, estado interno.
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean | ((p: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(open) : v;
    if (onOpenChange) onOpenChange(next);
    else setOpenInternal(next);
  };
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QuickReply[]>([]);
  const [query, setQuery] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega lazy: só na 1ª vez que abre, depois mantém cache.
  useEffect(() => {
    if (!open || items.length > 0) return;
    setLoading(true);
    supabase
      .from("quick_replies")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true })
      .then(({ data }) => {
        setItems((data ?? []) as QuickReply[]);
        setLoading(false);
      });
  }, [open, items.length, supabase]);

  // Foca a busca ao abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\/+/, "");
    if (!q) return items;
    return items.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.shortcut?.toLowerCase().includes(q) ||
      r.body?.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    setFocusIdx(0);
  }, [query]);

  function pick(r: QuickReply) {
    onPick(r.body ?? "", r.attachments ?? []);
    setOpen(false);
    setQuery("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = filtered[focusIdx];
      if (r) pick(r);
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Respostas rápidas"
        title="Respostas rápidas (Ctrl+/)"
        className={cn(open && "bg-secondary text-foreground")}
      >
        <Zap className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[360px] max-w-[80vw] overflow-hidden rounded-lg border border-border bg-popover shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="border-b border-border/40 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Buscar resposta… (↑↓ pra navegar, Enter pra inserir)"
                className="h-9 w-full rounded-md bg-secondary/60 px-8 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto scroll-thin">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
              </div>
            ) : filtered.length === 0 ? (
              <div className="space-y-1 p-6 text-center text-xs text-muted-foreground">
                <Zap className="mx-auto h-5 w-5 opacity-50" />
                <p>
                  {query
                    ? `Sem resposta pra "${query.replace(/^\/+/, "")}".`
                    : "Nenhuma resposta rápida criada ainda."}
                </p>
                <a href="/respostas-rapidas" target="_blank" rel="noreferrer" className="block text-primary hover:underline">
                  Gerenciar respostas rápidas →
                </a>
              </div>
            ) : (
              <ul className="p-1">
                {filtered.map((r, idx) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setFocusIdx(idx)}
                      onClick={() => pick(r)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors",
                        idx === focusIdx ? "bg-secondary" : "hover:bg-secondary/60",
                      )}
                    >
                      <div className="rounded-md bg-primary/15 p-1.5 text-primary shrink-0">
                        <Zap className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] font-medium truncate">{r.title}</span>
                          {r.shortcut && (
                            <code className="rounded bg-muted px-1 py-0 text-[10px] font-mono">/{r.shortcut}</code>
                          )}
                        </div>
                        {r.body && (
                          <p className="line-clamp-2 text-[11px] text-muted-foreground whitespace-pre-wrap">{r.body}</p>
                        )}
                        {r.attachments.length > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            {r.attachments.slice(0, 4).map((a, i) => {
                              const I = attIcon(a.mime);
                              return (
                                <span key={i} className="inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[9px] text-muted-foreground">
                                  <I className="h-2.5 w-2.5" /> {a.mime.split("/")[0]}
                                </span>
                              );
                            })}
                            {r.attachments.length > 4 && (
                              <span className="text-[9px] text-muted-foreground">+{r.attachments.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5 text-[10px] text-muted-foreground">
            <span>{filtered.length} resposta{filtered.length !== 1 ? "s" : ""}</span>
            <a href="/respostas-rapidas" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Gerenciar →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
