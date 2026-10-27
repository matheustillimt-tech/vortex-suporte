"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  Bug, CheckCircle2, ChevronRight, ChevronDown, Clock, Loader2, Search, Trash2, XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BugReport, BugStatus } from "@/lib/supabase/types";

const STATUS_META: Record<BugStatus, { label: string; variant: "warning" | "success" | "muted" | "default"; Icon: typeof Clock }> = {
  open:          { label: "Aberto",         variant: "warning", Icon: Bug },
  investigating: { label: "Investigando",   variant: "default", Icon: Clock },
  fixed:         { label: "Resolvido",      variant: "success", Icon: CheckCircle2 },
  wont_fix:      { label: "Não será corrigido", variant: "muted", Icon: XCircle },
  duplicate:     { label: "Duplicado",      variant: "muted",   Icon: XCircle },
};

type FilterTab = "open" | "investigating" | "fixed" | "all";

/** Destinos oferecidos na barra de ação em massa — mesmo rótulo da aba. */
const BULK_TARGETS: { status: BugStatus; label: string }[] = [
  { status: "investigating", label: "Investigando" },
  { status: "fixed", label: "Resolvidos" },
];

const BULK_ERRORS: Record<string, string> = {
  unauthorized: "Sua sessão expirou. Entre de novo e tente outra vez.",
  forbidden: "Sua conta não tem permissão pra alterar bugs.",
  rate_limited: "Muitas ações em massa seguidas. Espere alguns minutos.",
  invalid_payload: "Seleção inválida. Recarregue a página e tente de novo.",
  db_error: "O banco recusou parte da alteração. Confira a lista — o que passou já está atualizado.",
};

export function BugsAdmin({ initial }: { initial: BugReport[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<BugReport[]>(initial);
  const [tab, setTab] = useState<FilterTab>("open");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<BugStatus | null>(null);

  const counts = {
    open: items.filter((b) => b.status === "open").length,
    investigating: items.filter((b) => b.status === "investigating").length,
    fixed: items.filter((b) => b.status === "fixed").length,
    all: items.length,
  };

  const filtered = items.filter((b) => {
    if (tab !== "all" && b.status !== (tab as BugStatus)) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        b.description.toLowerCase().includes(q) ||
        b.reporter_email?.toLowerCase().includes(q) ||
        b.reporter_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function changeStatus(b: BugReport, status: BugStatus) {
    const patch: Partial<BugReport> = {
      status,
      ...(status === "fixed" || status === "wont_fix" || status === "duplicate"
        ? { resolved_at: new Date().toISOString() }
        : { resolved_at: null }),
    };
    const { data, error } = await supabase
      .from("bug_reports")
      .update(patch)
      .eq("id", b.id)
      .select("*")
      .single();
    if (error) return alert(error.message);
    setItems((p) => p.map((x) => (x.id === b.id ? (data as BugReport) : x)));
  }

  async function remove(b: BugReport) {
    if (!confirm("Apagar este bug report?")) return;
    const { error } = await supabase.from("bug_reports").delete().eq("id", b.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== b.id));
    setSelected((p) => {
      if (!p.has(b.id)) return p;
      const next = new Set(p);
      next.delete(b.id);
      return next;
    });
  }

  // A seleção vive dentro da visão atual: trocar de aba ou de busca zera, pra
  // ninguém mover em massa um bug que não está mais na tela.
  function switchTab(next: FilterTab) {
    setTab(next);
    setSelected(new Set());
  }

  function search(next: string) {
    setQuery(next);
    setSelected(new Set());
  }

  // Só conta quem está visível na aba/busca atual — um bug que saiu da visão
  // (mudou de status pela linha) nunca entra numa ação em massa.
  const selectedIds = filtered.filter((b) => selected.has(b.id)).map((b) => b.id);
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((b) => b.id)));
  }

  function toggleOne(id: string) {
    setSelected((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkMove(status: BugStatus) {
    const ids = selectedIds;
    if (ids.length === 0 || bulkBusy) return;

    const target = BULK_TARGETS.find((t) => t.status === status)?.label ?? STATUS_META[status].label;
    const quantos = `${ids.length} ${ids.length === 1 ? "bug" : "bugs"}`;
    if (!confirm(`Deseja mover ${quantos} para ${target}?`)) return;

    setBulkBusy(status);
    try {
      const res = await fetch("/api/admin/bugs/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      const json = await res.json().catch(() => ({}));
      const updated: BugReport[] = json.updated ?? [];

      if (updated.length) {
        const byId = new Map(updated.map((u) => [u.id, u]));
        setItems((p) => p.map((x) => byId.get(x.id) ?? x));
      }

      if (!res.ok) {
        alert(BULK_ERRORS[json.error as string] ?? "Não deu pra mover os bugs. Tente de novo.");
        return;
      }
      setSelected(new Set());
    } catch {
      alert("Falha de conexão. Confira a internet e tente de novo.");
    } finally {
      setBulkBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Bug className="h-5 w-5 text-red-400" />
          Bug reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Reports enviados pelo widget. NÃO aparecem no inbox de suporte.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => switchTab(v as FilterTab)}>
          <TabsList className="h-9 bg-secondary/60">
            <TabsTrigger value="open" className="h-7 px-3 text-xs">
              Abertos <Count n={counts.open} />
            </TabsTrigger>
            <TabsTrigger value="investigating" className="h-7 px-3 text-xs">
              Investigando <Count n={counts.investigating} />
            </TabsTrigger>
            <TabsTrigger value="fixed" className="h-7 px-3 text-xs">
              Resolvidos <Count n={counts.fixed} />
            </TabsTrigger>
            <TabsTrigger value="all" className="h-7 px-3 text-xs">
              Todos <Count n={counts.all} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Buscar por descrição, e-mail ou nome…"
            className="h-9 pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          <Bug className="h-7 w-7" />
          <p>{query ? `Sem resultados pra "${query}".` : "Nenhum bug por enquanto. 🎉"}</p>
        </div>
      ) : (
        <>
          {selectedIds.length > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
              <span className="text-sm font-medium">
                {selectedIds.length} {selectedIds.length === 1 ? "selecionado" : "selecionados"}
              </span>
              <span className="h-4 w-px bg-border" />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mover para:</span>
              {BULK_TARGETS.map((t) => (
                <Button
                  key={t.status}
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy !== null}
                  onClick={() => bulkMove(t.status)}
                  className="h-7 px-2 text-[11px]"
                >
                  {bulkBusy === t.status && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                disabled={bulkBusy !== null}
                onClick={() => setSelected(new Set())}
                className="ml-auto h-7 px-2 text-[11px] text-muted-foreground"
              >
                Cancelar seleção
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={allSelected}
              indeterminate={selectedIds.length > 0 && !allSelected}
              onChange={toggleAll}
              disabled={bulkBusy !== null}
              id="bugs-select-all"
            />
            <label
              htmlFor="bugs-select-all"
              className="cursor-pointer select-none text-xs text-muted-foreground"
            >
              Selecionar todos ({filtered.length})
            </label>
          </div>

          <ul className="space-y-2">
            {filtered.map((b) => (
              <BugRow
                key={b.id}
                b={b}
                selected={selected.has(b.id)}
                onToggleSelect={() => toggleOne(b.id)}
                selectDisabled={bulkBusy !== null}
                onChangeStatus={(s) => changeStatus(b, s)}
                onDelete={() => remove(b)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="ml-1.5 rounded bg-primary/20 px-1 text-[9px] font-semibold text-primary">{n}</span>;
}

function BugRow({
  b, selected, onToggleSelect, selectDisabled, onChangeStatus, onDelete,
}: {
  b: BugReport;
  selected: boolean;
  onToggleSelect: () => void;
  selectDisabled: boolean;
  onChangeStatus: (s: BugStatus) => Promise<void>;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[b.status];
  const Icon = meta.Icon;

  async function setStatus(s: BugStatus) {
    setBusy(true);
    await onChangeStatus(s);
    setBusy(false);
  }

  return (
    <li className={cn(
      "rounded-xl border bg-card overflow-hidden",
      selected && "border-primary/50 bg-primary/5",
    )}>
      <div className="flex items-start">
        <div className="py-4 pl-3">
          <Checkbox
            checked={selected}
            onChange={onToggleSelect}
            disabled={selectDisabled}
            aria-label={`Selecionar bug de ${b.reporter_email ?? "contato sem e-mail"}`}
          />
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-start gap-3 p-3 text-left hover:bg-secondary/30"
        >
          <div className={cn(
            "rounded-md p-2",
            b.status === "open" && "bg-red-500/15 text-red-400",
            b.status === "investigating" && "bg-amber-500/15 text-amber-400",
            b.status === "fixed" && "bg-emerald-500/15 text-emerald-400",
            (b.status === "wont_fix" || b.status === "duplicate") && "bg-muted text-muted-foreground",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR })}
              </span>
              {b.reporter_email && (
                <span className="text-[11px] text-muted-foreground">• {b.reporter_email}</span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-snug">{b.description}</p>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border/40 bg-background/50 p-3">
          <Section title="Descrição completa">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{b.description}</p>
          </Section>

          {Object.keys(b.context).length > 0 && (
            <Section title="Contexto técnico">
              <pre className="overflow-auto rounded bg-card p-2.5 text-[11px] leading-relaxed">
                {JSON.stringify(b.context, null, 2)}
              </pre>
            </Section>
          )}

          {b.reporter_email && (
            <Section title="Reportado por">
              <p className="text-sm">
                <span className="font-medium">{b.reporter_name ?? "—"}</span>{" "}
                <span className="text-muted-foreground">&lt;{b.reporter_email}&gt;</span>
              </p>
            </Section>
          )}

          <Section title="Datas">
            <p className="text-xs text-muted-foreground">
              Criado em {format(new Date(b.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
              {b.resolved_at && ` • Resolvido em ${format(new Date(b.resolved_at), "dd/MM/yy HH:mm", { locale: ptBR })}`}
            </p>
          </Section>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mover para:</span>
            {(["open", "investigating", "fixed", "wont_fix", "duplicate"] as BugStatus[])
              .filter((s) => s !== b.status)
              .map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStatus(s)}
                  className="h-7 px-2 text-[11px]"
                >
                  {STATUS_META[s].label}
                </Button>
              ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="ml-auto h-7 px-2 text-[11px] text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Apagar
            </Button>
          </div>

          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}
    </li>
  );
}

function Checkbox({
  checked, indeterminate = false, onChange, disabled, id, "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // `indeterminate` só existe como propriedade do DOM — não dá pra passar como atributo.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}
