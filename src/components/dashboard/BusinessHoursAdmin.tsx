"use client";

import { useMemo, useState } from "react";
import { Building2, Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/widget-meta";
import type { BusinessHours, Department } from "@/lib/supabase/types";

type Props = { departments: Department[]; initialHours: BusinessHours[] };

export function BusinessHoursAdmin({ departments, initialHours }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [hours, setHours] = useState<BusinessHours[]>(initialHours);
  const [activeDept, setActiveDept] = useState<string | null>(departments[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  // novo slot temporário
  const [draftWeekday, setDraftWeekday] = useState(1);
  const [draftStart, setDraftStart] = useState("08:00");
  const [draftEnd, setDraftEnd] = useState("18:00");

  if (departments.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-xl font-semibold">Horário de atendimento</h1>
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-6 w-6" />
          Crie ao menos um departamento antes em <a className="text-primary underline" href="/admin/departments">Departamentos</a>.
        </div>
      </div>
    );
  }

  const visibleHours = hours
    .filter((h) => h.department_id === activeDept)
    .sort((a, b) => (a.weekday - b.weekday) || a.start_time.localeCompare(b.start_time));

  async function add() {
    if (!activeDept) return;
    setBusy(true);
    const { data, error } = await supabase.from("business_hours").insert({
      department_id: activeDept,
      weekday: draftWeekday,
      start_time: draftStart + ":00",
      end_time: draftEnd + ":00",
    }).select("*").single();
    setBusy(false);
    if (error) return alert(error.message);
    setHours((p) => [...p, data as BusinessHours]);
  }

  async function remove(h: BusinessHours) {
    const { error } = await supabase.from("business_hours").delete().eq("id", h.id);
    if (error) return alert(error.message);
    setHours((p) => p.filter((x) => x.id !== h.id));
  }

  function fmtTime(t: string) { return t.slice(0, 5); }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Horário de atendimento</h1>
        <p className="text-sm text-muted-foreground">
          Defina janelas semanais por departamento. Configure abaixo a mensagem exibida fora desses horários.
        </p>
      </header>

      {/* Dept tabs */}
      <div className="flex flex-wrap gap-1.5">
        {departments.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActiveDept(d.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeDept === d.id ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Add slot */}
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar janela</h2>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Dia</Label>
            <select
              value={draftWeekday}
              onChange={(e) => setDraftWeekday(Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {WEEKDAY_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="time" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} className="w-28" />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="time" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} className="w-28" />
          </div>
          <Button onClick={add} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </div>
      </section>

      {/* Slots */}
      {visibleHours.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          <Clock className="mx-auto mb-2 h-6 w-6" />
          Nenhuma janela cadastrada pra este departamento.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WEEKDAY_NAMES.map((day, i) => {
            const slots = visibleHours.filter((h) => h.weekday === i);
            if (slots.length === 0) return null;
            return (
              <div key={i} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{day}</span>
                  <Badge variant="muted" className="text-[10px]">{WEEKDAY_SHORT[i]}</Badge>
                </div>
                <ul className="space-y-1.5">
                  {slots.map((h) => (
                    <li key={h.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                      <span className="font-mono">{fmtTime(h.start_time)} → {fmtTime(h.end_time)}</span>
                      <Button size="icon" variant="ghost" onClick={() => remove(h)} className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
