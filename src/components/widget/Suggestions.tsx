"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronUp, Clock, Lightbulb, Loader2, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SUGGESTION_STATUS_LABEL, SUGGESTION_STATUS_VARIANT } from "@/lib/widget-meta";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/lib/supabase/types";

type Props = { projectKey: string; sessionToken: string | null };

export function Suggestions({ projectKey, sessionToken }: Props) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [pendingMine, setPendingMine] = useState<Suggestion[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/widget/suggestions?project=${projectKey}`, {
      headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      setItems([]);
      return;
    }
    const data = await res.json() as {
      suggestions: Suggestion[];
      pendingMine?: Suggestion[];
      votedIds: string[];
    };
    setItems(data.suggestions);
    setPendingMine(data.pendingMine ?? []);
    setVoted(new Set(data.votedIds));
  }, [projectKey, sessionToken]);

  useEffect(() => { void load(); }, [load]);

  async function toggleVote(s: Suggestion) {
    if (!sessionToken) return;
    const already = voted.has(s.id);
    // optimistic
    setVoted((p) => {
      const next = new Set(p);
      already ? next.delete(s.id) : next.add(s.id);
      return next;
    });
    setItems((prev) => prev?.map((x) =>
      x.id === s.id ? { ...x, vote_count: x.vote_count + (already ? -1 : 1) } : x,
    ) ?? null);

    await fetch(`/api/widget/suggestions/${s.id}/vote`, {
      method: "POST",
      headers: { authorization: `Bearer ${sessionToken}` },
    }).catch(() => void load());
  }

  if (items === null) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  if (showForm) {
    return (
      <SuggestionForm
        onCancel={() => setShowForm(false)}
        onCreated={(s) => {
          // Não entra na lista pública: fica na fila de análise até um admin aprovar.
          setPendingMine((p) => [s, ...p]);
          setShowForm(false);
          setJustSent(true);
        }}
        sessionToken={sessionToken}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/40 p-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowForm(true)}
          disabled={!sessionToken}
        >
          <Plus className="h-4 w-4" /> {sessionToken ? "Sugerir nova ideia" : "Entre no chat antes de sugerir"}
        </Button>
      </div>

      {justSent && (
        <div className="flex items-start gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1 text-xs leading-relaxed">
            Sugestão enviada e aguardando análise da equipe. Assim que for aprovada,
            ela aparece aqui pra todo mundo poder votar.
          </p>
          <button
            type="button"
            onClick={() => setJustSent(false)}
            aria-label="Fechar aviso"
            className="text-emerald-300/70 transition-colors hover:text-emerald-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {pendingMine.length > 0 && (
        <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Suas ideias em análise
          </h4>
          <ul className="space-y-2">
            {pendingMine.map((s) => (
              <li key={s.id} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium leading-tight">{s.title}</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Aguardando análise da equipe
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
          <Lightbulb className="h-8 w-8" />
          <p className="text-sm">
            {pendingMine.length > 0
              ? "Nenhuma ideia publicada ainda por aqui."
              : "Seja a primeira a sugerir 🚀"}
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-auto scroll-thin divide-y divide-border/40">
          {items.map((s) => {
            const did = voted.has(s.id);
            return (
              <li key={s.id} className="flex gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleVote(s)}
                  disabled={!sessionToken}
                  className={cn(
                    "flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-md border transition-colors",
                    did
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 bg-card text-muted-foreground hover:border-primary/40",
                    !sessionToken && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold leading-none">{s.vote_count}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold leading-tight">{s.title}</h3>
                    {s.status !== "open" && (
                      <Badge variant={SUGGESTION_STATUS_VARIANT[s.status]} className="text-[10px]">
                        {SUGGESTION_STATUS_LABEL[s.status]}
                      </Badge>
                    )}
                  </div>
                  {s.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{s.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SuggestionForm({
  onCancel, onCreated, sessionToken,
}: { onCancel: () => void; onCreated: (s: Suggestion) => void; sessionToken: string | null }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setBusy(true);
    const res = await fetch("/api/widget/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      alert("Erro ao enviar sugestão.");
      return;
    }
    const data = await res.json() as { suggestion: Suggestion };
    onCreated(data.suggestion);
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col p-4">
      <h3 className="text-base font-semibold mb-3">Sua ideia</h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Atalho de teclado para responder" />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição (opcional)</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Detalhe um pouco mais o problema ou caso de uso..."
          />
        </div>
      </div>
      <div className="mt-auto flex gap-2 pt-3">
        <Button variant="outline" type="button" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={busy || !title.trim()} className="flex-1">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar
        </Button>
      </div>
    </form>
  );
}
