"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Check, ChevronUp, Clock, Lightbulb, Loader2, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SUGGESTION_STATUS_LABEL,
  SUGGESTION_STATUS_VARIANT,
  SUGGESTION_MODERATION_LABEL,
  SUGGESTION_MODERATION_VARIANT,
} from "@/lib/widget-meta";
import { cn } from "@/lib/utils";
import type { Suggestion, SuggestionStatus, SuggestionModeration } from "@/lib/supabase/types";

const STATUSES: SuggestionStatus[] = ["open", "planned", "in_progress", "completed", "declined"];

/** Rótulos das abas de moderação — plural, porque nomeiam um recorte da lista. */
const MODERATION_TABS: { key: SuggestionModeration; label: string }[] = [
  { key: "pending", label: "Aguardando aprovação" },
  { key: "approved", label: "Publicadas" },
  { key: "rejected", label: "Recusadas" },
];

export function SuggestionsAdmin({ initial, agentId }: { initial: Suggestion[]; agentId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Suggestion[]>(initial);
  const [moderation, setModeration] = useState<SuggestionModeration | "all">("all");
  const [filter, setFilter] = useState<SuggestionStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changeStatus(s: Suggestion, status: SuggestionStatus) {
    const { error } = await supabase.from("suggestions").update({ status }).eq("id", s.id);
    if (error) return alert(error.message);
    setItems((p) => p.map((x) => (x.id === s.id ? { ...x, status } : x)));
  }

  async function moderate(s: Suggestion, next: SuggestionModeration) {
    // Tirar do ar algo que o público já vê merece uma confirmação.
    if (next === "rejected" && s.moderation_status === "approved") {
      if (!confirm(`"${s.title}" já está pública. Recusar vai tirá-la da lista e dos votos. Continuar?`)) return;
    }

    const patch = {
      moderation_status: next,
      moderated_at: new Date().toISOString(),
      moderated_by: agentId,
    };

    setBusyId(s.id);
    const { error } = await supabase.from("suggestions").update(patch).eq("id", s.id);
    setBusyId(null);
    if (error) return alert(error.message);
    setItems((p) => p.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
  }

  async function remove(s: Suggestion) {
    if (!confirm(`Excluir a sugestão "${s.title}"?`)) return;
    const { error } = await supabase.from("suggestions").delete().eq("id", s.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== s.id));
  }

  const visible = items.filter((x) => {
    if (moderation !== "all" && x.moderation_status !== moderation) return false;
    if (filter !== "all" && x.status !== filter) return false;
    return true;
  });

  const modCounts: Record<string, number> = {};
  for (const s of items) modCounts[s.moderation_status] = (modCounts[s.moderation_status] ?? 0) + 1;

  // O contador de status acompanha o recorte de moderação escolhido.
  const scoped = moderation === "all" ? items : items.filter((x) => x.moderation_status === moderation);
  const counts: Record<string, number> = { all: scoped.length };
  for (const s of scoped) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const pending = modCounts.pending ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Sugestões</h1>
        <p className="text-sm text-muted-foreground">
          Ideias enviadas pelos clientes na aba "Sugestões" do widget. Toda sugestão nova
          entra como pendente e só aparece pro público depois de aprovada.
        </p>
      </header>

      {pending > 0 && moderation !== "pending" && (
        <button
          type="button"
          onClick={() => setModeration("pending")}
          className="flex w-full items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-left text-sm text-amber-200 transition-colors hover:bg-amber-500/15"
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            <strong>{pending}</strong> {pending === 1 ? "sugestão aguardando" : "sugestões aguardando"} sua análise
          </span>
          <span className="ml-auto text-xs opacity-80">Ver agora →</span>
        </button>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">Moderação:</span>
          <FilterTab label="Todas" count={items.length} active={moderation === "all"} onClick={() => setModeration("all")} />
          {MODERATION_TABS.map((t) => (
            <FilterTab
              key={t.key}
              label={t.label}
              count={modCounts[t.key] ?? 0}
              active={moderation === t.key}
              highlight={t.key === "pending" && (modCounts.pending ?? 0) > 0}
              onClick={() => setModeration(t.key)}
            />
          ))}
        </div>

        {/* Status é o andamento de uma ideia já aprovada — não faz sentido na fila de espera. */}
        {moderation !== "pending" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">Status:</span>
            <FilterTab label="Todos" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
            {STATUSES.map((st) => (
              <FilterTab
                key={st}
                label={SUGGESTION_STATUS_LABEL[st]}
                count={counts[st] ?? 0}
                active={filter === st}
                onClick={() => setFilter(st)}
              />
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          <Lightbulb className="mx-auto mb-2 h-6 w-6" />
          {items.length === 0
            ? "Nenhuma sugestão recebida ainda."
            : moderation === "pending"
              ? "Nenhuma sugestão esperando análise. 🎉"
              : "Nenhuma sugestão neste filtro."}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => {
            const isPending = s.moderation_status === "pending";
            const isRejected = s.moderation_status === "rejected";
            const busy = busyId === s.id;

            return (
              <li
                key={s.id}
                className={cn(
                  "rounded-xl border bg-card p-4 flex gap-3",
                  isPending && "border-amber-500/40",
                  isRejected && "opacity-70",
                )}
              >
                <div className={cn(
                  "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md",
                  isPending ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
                )}>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span className="text-sm font-bold leading-none">{s.vote_count}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                    <Badge variant={SUGGESTION_MODERATION_VARIANT[s.moderation_status]}>
                      {SUGGESTION_MODERATION_LABEL[s.moderation_status]}
                    </Badge>
                    {/* Status só diz algo depois que a ideia foi publicada. */}
                    {s.moderation_status === "approved" && (
                      <Badge variant={SUGGESTION_STATUS_VARIANT[s.status]}>
                        {SUGGESTION_STATUS_LABEL[s.status]}
                      </Badge>
                    )}
                  </div>
                  {s.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{s.description}</p>}
                  <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                    Criada em {format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    {s.moderated_at && !isPending && (
                      <> • {isRejected ? "Recusada" : "Aprovada"} em {format(new Date(s.moderated_at), "dd/MM/yyyy", { locale: ptBR })}</>
                    )}
                  </p>

                  {isPending && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" disabled={busy} onClick={() => moderate(s, "approved")} className="h-8 px-3 text-xs">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Aprovar sugestão
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => moderate(s, "rejected")} className="h-8 px-3 text-xs">
                        <X className="h-3.5 w-3.5" />
                        Recusar
                      </Button>
                    </div>
                  )}

                  {isRejected && (
                    <div className="mt-3">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => moderate(s, "approved")} className="h-8 px-3 text-xs">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Aprovar mesmo assim
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {s.moderation_status === "approved" && (
                    <>
                      <select
                        value={s.status}
                        onChange={(e) => changeStatus(s, e.target.value as SuggestionStatus)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>{SUGGESTION_STATUS_LABEL[st]}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => moderate(s, "rejected")}
                        className="h-8 px-2 text-[11px] text-muted-foreground"
                      >
                        Tirar do público
                      </Button>
                    </>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => remove(s)} className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterTab({
  label, count, active, onClick, highlight = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : highlight
            ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
            : "bg-muted/40 text-muted-foreground hover:bg-muted",
      )}
    >
      {label} <span className="ml-1 opacity-70">{count}</span>
    </button>
  );
}
