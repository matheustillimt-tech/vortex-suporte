"use client";

import { Clock, CalendarClock } from "lucide-react";

export type ScheduleSlot = { weekday: number; start: string; end: string };

const DIAS_ABBR = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
// Ordem de exibição: segunda → domingo (mais natural que domingo primeiro).
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

export function OfflineNotice({
  message,
  nextOpenLabel,
  schedule = [],
}: {
  message: string;
  nextOpenLabel?: string | null;
  schedule?: ScheduleSlot[];
}) {
  // Agrupa as faixas por dia da semana.
  const byDay = new Map<number, string[]>();
  for (const s of schedule) {
    const arr = byDay.get(s.weekday) ?? [];
    arr.push(`${s.start}–${s.end}`);
    byDay.set(s.weekday, arr);
  }
  const linhas = ORDEM.filter((d) => byDay.has(d)).map((d) => ({
    dia: DIAS_ABBR[d],
    faixas: (byDay.get(d) ?? []).join(", "),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto scroll-thin p-5">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="mb-3 flex items-center gap-2 text-amber-300">
          <div className="rounded-full bg-amber-500/20 p-1.5">
            <Clock className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Fora do horário de atendimento</span>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {message}
        </p>

        {nextOpenLabel && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>Voltamos <strong className="font-semibold">{nextOpenLabel}</strong>.</span>
          </div>
        )}

        {linhas.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Horário de atendimento
            </div>
            <ul className="space-y-0.5 text-[13px] text-foreground/80">
              {linhas.map((l) => (
                <li key={l.dia} className="flex justify-between gap-4">
                  <span>{l.dia}</span>
                  <span className="tabular-nums">{l.faixas}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
