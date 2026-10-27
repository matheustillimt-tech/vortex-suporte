"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, CheckCircle2, Clock, Hourglass, Loader2, MessageSquare,
  Sparkles, Tag, Timer, TrendingUp, Users,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  status: "waiting" | "in_progress" | "closed";
  first_message_at: string;
  closed_at: string | null;
  close_reason_label: string | null;
  close_reason_note: string | null;
  assigned_agent_id: string | null;
  department_id: string | null;
  first_agent_msg_at: string | null;
};

type Preset = "today" | "yesterday" | "7d" | "month" | "30d";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "month", label: "Este mês" },
  { key: "30d", label: "Últimos 30 dias" },
];

function rangeFor(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  switch (preset) {
    case "today":     return { start: today, end: tomorrow };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { start: y, end: today };
    }
    case "7d": {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return { start: s, end: tomorrow };
    }
    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end: tomorrow };
    }
    case "30d": {
      const s = new Date(today); s.setDate(s.getDate() - 29);
      return { start: s, end: tomorrow };
    }
  }
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds - h * 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}

export function AdminDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [preset, setPreset] = useState<Preset>("7d");
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    const { start, end } = rangeFor(preset);
    (async () => {
      const { data, error } = await supabase.rpc("dashboard_conversations", {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      });
      if (cancelled) return;
      if (error) {
        console.error("[dashboard]", error);
        setRows([]);
        return;
      }
      setRows((data ?? []) as Row[]);
    })();
    return () => { cancelled = true; };
  }, [supabase, preset]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const total = rows.length;
    const closed = rows.filter((r) => r.status === "closed").length;
    const inProgress = rows.filter((r) => r.status === "in_progress").length;
    const waiting = rows.filter((r) => r.status === "waiting").length;

    // Tempo de espera (queue): primeira resposta de agente - início da conv
    const waitTimes = rows
      .filter((r) => r.first_agent_msg_at)
      .map((r) => (new Date(r.first_agent_msg_at!).getTime() - new Date(r.first_message_at).getTime()) / 1000)
      .filter((s) => s > 0);
    const avgWait = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

    // Tempo total de atendimento (closed - first_message)
    const totalTimes = rows
      .filter((r) => r.status === "closed" && r.closed_at)
      .map((r) => (new Date(r.closed_at!).getTime() - new Date(r.first_message_at).getTime()) / 1000)
      .filter((s) => s > 0);
    const avgTotal = totalTimes.length ? totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length : 0;

    // Motivos: agrupa label (Outros agrupa todos os "Outros" mesmo com notes diferentes)
    const reasonCount = new Map<string, number>();
    for (const r of rows.filter((x) => x.status === "closed" && x.close_reason_label)) {
      const key = r.close_reason_label!;
      reasonCount.set(key, (reasonCount.get(key) ?? 0) + 1);
    }
    const reasons = Array.from(reasonCount.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // Volume por dia (criadas e fechadas)
    const dayCreated = new Map<string, number>();
    const dayClosed = new Map<string, number>();
    for (const r of rows) {
      const dStart = format(new Date(r.first_message_at), "yyyy-MM-dd");
      dayCreated.set(dStart, (dayCreated.get(dStart) ?? 0) + 1);
      if (r.closed_at) {
        const dEnd = format(new Date(r.closed_at), "yyyy-MM-dd");
        dayClosed.set(dEnd, (dayClosed.get(dEnd) ?? 0) + 1);
      }
    }
    const allDays = Array.from(new Set([...dayCreated.keys(), ...dayClosed.keys()])).sort();
    const daily = allDays.map((d) => ({
      day: d,
      created: dayCreated.get(d) ?? 0,
      closed: dayClosed.get(d) ?? 0,
    }));

    return { total, closed, inProgress, waiting, avgWait, avgTotal, reasons, daily };
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6" /> Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão geral dos atendimentos no período. Atualizado em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                preset === p.key
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border/40 text-muted-foreground hover:bg-secondary/40",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {rows === null ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !stats || stats.total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum atendimento no período selecionado.</p>
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard icon={MessageSquare} label="Total"          value={stats.total} accent="primary" />
            <KpiCard icon={CheckCircle2} label="Concluídas"      value={stats.closed} accent="green" />
            <KpiCard icon={Users} label="Em atendimento"          value={stats.inProgress} accent="blue" />
            <KpiCard icon={Hourglass} label="Aguardando"          value={stats.waiting} accent="amber" />
          </section>

          {/* SLA */}
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SlaCard
              icon={Clock}
              title="Tempo médio na fila"
              hint="Tempo entre o cliente abrir e o atendente responder pela primeira vez"
              value={formatDuration(stats.avgWait)}
            />
            <SlaCard
              icon={Timer}
              title="Duração média do atendimento"
              hint="Tempo total entre início e finalização (só conversas concluídas)"
              value={formatDuration(stats.avgTotal)}
            />
          </section>

          {/* Gráfico de eficiência */}
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 pb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Atendimentos por dia</h2>
            </div>
            {stats.daily.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <BarChart data={stats.daily} />
            )}
          </section>

          {/* Motivos */}
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 pb-3">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Distribuição dos motivos de finalização</h2>
            </div>
            {stats.reasons.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa finalizada com motivo marcado no período.
              </p>
            ) : (
              <ReasonsList items={stats.reasons} total={stats.closed} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ----------------- subcomponents -----------------

const ACCENT_MAP: Record<string, string> = {
  primary: "from-primary/30 to-primary/5  text-primary",
  green:   "from-emerald-500/30 to-emerald-500/5 text-emerald-400",
  blue:    "from-sky-500/30 to-sky-500/5     text-sky-400",
  amber:   "from-amber-500/30 to-amber-500/5 text-amber-400",
};

function KpiCard({
  icon: Icon, label, value, accent,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent: keyof typeof ACCENT_MAP }) {
  return (
    <div className={cn(
      "rounded-xl border bg-gradient-to-br p-4 shadow-sm",
      "bg-card",
    )}>
      <div className={cn("flex items-center justify-between", ACCENT_MAP[accent].split(" ").slice(-1))}>
        <Icon className="h-4 w-4 opacity-80" />
        <span className="text-[10.5px] uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function SlaCard({
  icon: Icon, title, hint, value,
}: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function BarChart({ data }: { data: { day: string; created: number; closed: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.created, d.closed)));
  return (
    <div>
      <div className="flex h-44 items-end gap-2 overflow-x-auto pb-1 scroll-thin">
        {data.map((d) => {
          const date = new Date(d.day + "T00:00:00");
          const dayLabel = format(date, "dd/MM", { locale: ptBR });
          return (
            <div key={d.day} className="flex min-w-[28px] flex-1 flex-col items-center gap-1">
              <div className="relative flex h-full items-end gap-0.5">
                <div
                  className="w-3 rounded-t bg-primary/70 transition-all hover:bg-primary"
                  style={{ height: `${(d.created / max) * 100}%`, minHeight: d.created > 0 ? "4px" : 0 }}
                  title={`Iniciadas: ${d.created}`}
                />
                <div
                  className="w-3 rounded-t bg-emerald-500/70 transition-all hover:bg-emerald-500"
                  style={{ height: `${(d.closed / max) * 100}%`, minHeight: d.closed > 0 ? "4px" : 0 }}
                  title={`Concluídas: ${d.closed}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{dayLabel}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <Legend color="bg-primary/70" label="Iniciadas" />
        <Legend color="bg-emerald-500/70" label="Concluídas" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", color)} />
      {label}
    </div>
  );
}

function ReasonsList({ items, total }: { items: { label: string; count: number }[]; total: number }) {
  const maxCount = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-2.5">
      {items.map((r) => {
        const pct = total > 0 ? (r.count / total) * 100 : 0;
        const barPct = (r.count / maxCount) * 100;
        return (
          <li key={r.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} <span className="text-xs">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary/40">
              <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${barPct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
