import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProjectKeyValid, getExpectedProjectKey } from "@/lib/widget-project";

export const runtime = "nodejs";

type Slot = { weekday: number; start_time: string; end_time: string };

// Parte de "agora" (dia da semana + minutos desde meia-noite) na timezone dada.
function nowInTz(tz: string): { dow: number; minutes: number } {
  const local = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  return { dow: local.getDay(), minutes: local.getHours() * 60 + local.getMinutes() };
}

function hhmm(t: string): string {
  return (t || "").slice(0, 5); // "09:00:00" → "09:00"
}
function toMin(t: string): number {
  const [h, m] = hhmm(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// Quando o suporte volta a abrir (label amigável) a partir de agora, na tz.
function computeNextOpen(slots: Slot[], tz: string): string | null {
  if (slots.length === 0) return null;
  const { dow, minutes } = nowInTz(tz);
  for (let d = 0; d <= 7; d++) {
    const wd = (dow + d) % 7;
    const daySlots = slots
      .filter((s) => s.weekday === wd && (d > 0 || toMin(s.start_time) > minutes))
      .sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    if (daySlots.length === 0) continue;
    const start = hhmm(daySlots[0].start_time);
    if (d === 0) return `hoje às ${start}`;
    if (d === 1) return `amanhã às ${start}`;
    return `${DIAS[wd]} às ${start}`;
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectKey = searchParams.get("project") ?? getExpectedProjectKey();
  if (!isProjectKeyValid(projectKey)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [{ data: settings }, { data: blocks }, { data: openCheck }, { data: topics }, { data: hours }] =
    await Promise.all([
      supabase.from("widget_settings").select("*").eq("project_key", projectKey).maybeSingle(),
      supabase
        .from("home_blocks")
        .select("*")
        .eq("project_key", projectKey)
        .eq("enabled", true)
        .order("sort_order"),
      supabase.rpc("is_any_dept_open"),
      supabase
        .from("support_topics")
        .select("*")
        .eq("project_key", projectKey)
        .eq("enabled", true)
        .order("sort_order"),
      supabase.from("business_hours").select("weekday, start_time, end_time"),
    ]);

  const tz = settings?.timezone || "America/Sao_Paulo";
  const slots: Slot[] = (hours ?? []) as Slot[];
  // Agenda semanal: por dia, faixas ordenadas (só campos de exibição).
  const schedule = slots
    .map((s) => ({ weekday: s.weekday, start: hhmm(s.start_time), end: hhmm(s.end_time) }))
    .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));

  return NextResponse.json({
    settings: settings ?? null,
    blocks: blocks ?? [],
    isOnline: !!openCheck,
    topics: topics ?? [],
    // Dados pro aviso de fora-do-horário
    nextOpenLabel: !openCheck ? computeNextOpen(slots, tz) : null,
    schedule,
  });
}
