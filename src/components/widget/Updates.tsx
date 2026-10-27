"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Bell, ChevronLeft, Image as ImageIcon, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/lib/brand";
import type { Update } from "@/lib/supabase/types";

export function Updates({ projectKey }: { projectKey: string }) {
  const [items, setItems] = useState<Update[] | null>(null);
  const [open, setOpen] = useState<Update | null>(null);

  useEffect(() => {
    fetch(`/api/widget/updates?project=${projectKey}`)
      .then((r) => r.json())
      .then((d: { updates: Update[] }) => setItems(d.updates ?? []))
      .catch(() => setItems([]));
  }, [projectKey]);

  if (items === null) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  if (open) return <UpdateDetail update={open} onBack={() => setOpen(null)} />;

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <Bell className="h-8 w-8" />
        <p className="text-sm">Sem atualizações por enquanto</p>
        <p className="text-xs">Volte em breve para ver as novidades de {BRAND.name}.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scroll-thin">
      <ul className="divide-y divide-border/40">
        {items.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => setOpen(u)}
              className="flex w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/30"
            >
              {u.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.cover_image_url} alt={u.title} className="w-full rounded-lg object-cover max-h-40" />
              ) : null}
              <div className="flex items-center gap-2 flex-wrap">
                {u.pinned && <Badge variant="default" className="text-[10px]"><Pin className="mr-1 h-3 w-3" />Fixado</Badge>}
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(u.published_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              <h3 className="text-sm font-semibold leading-tight">📌 {u.title}</h3>
              {u.excerpt && <p className="text-xs text-muted-foreground line-clamp-2">{u.excerpt}</p>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpdateDetail({ update, onBack }: { update: Update; onBack: () => void }) {
  return (
    <div className="h-full overflow-auto scroll-thin">
      <button
        type="button"
        onClick={onBack}
        className="sticky top-0 z-10 flex w-full items-center gap-1.5 border-b border-border/60 bg-background/95 px-4 py-3 text-xs font-medium text-muted-foreground backdrop-blur"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <article className="px-4 py-4 space-y-3">
        {update.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={update.cover_image_url} alt={update.title} className="w-full rounded-lg object-cover max-h-56" />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(update.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <h1 className="text-lg font-semibold leading-tight">{update.title}</h1>
        </div>
        {update.body && (
          <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {update.body}
          </div>
        )}
      </article>
    </div>
  );
}
