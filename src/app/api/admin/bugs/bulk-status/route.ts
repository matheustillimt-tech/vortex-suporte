import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import type { BugReport } from "@/lib/supabase/types";

export const runtime = "nodejs";

// Anti-abuse — 30 ações em massa / 10 min por agente.
const RL_MAX = 30;
const RL_WINDOW = 600;

// Quantos ids por PATCH. NÃO é uma requisição por bug: o bloco existe só porque
// o PostgREST manda o filtro `in.(...)` na querystring — com algumas centenas de
// UUIDs a URL estoura o limite do gateway do Supabase.
const CHUNK = 100;

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  status: z.enum(["open", "investigating", "fixed", "wont_fix", "duplicate"]),
});

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Mesma régua da RLS ("agents update bugs"): qualquer agente pode mexer no status.
  const { data: me } = await sb.from("agents").select("id").eq("id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const ip = clientIp(req);
  const rl = rateLimit({ key: `admin:bugs:bulk:${user.id}:${ip}`, max: RL_MAX, windowSec: RL_WINDOW });
  if (rl.blocked) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(RL_WINDOW) } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const { status } = parsed.data;
  const ids = [...new Set(parsed.data.ids)];

  const patch = {
    status,
    // Mesma regra do update individual: só status terminal carimba resolved_at.
    resolved_at:
      status === "fixed" || status === "wont_fix" || status === "duplicate"
        ? new Date().toISOString()
        : null,
  };

  const updated: BugReport[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await sb
      .from("bug_reports")
      .update(patch)
      .in("id", ids.slice(i, i + CHUNK))
      .select("*");

    if (error) {
      console.error("[admin/bugs/bulk-status] db error:", error.message);
      // Devolve o que já passou pro client não ficar com a tela desatualizada.
      return NextResponse.json({ error: "db_error", updated }, { status: 500 });
    }
    updated.push(...((data ?? []) as BugReport[]));
  }

  return NextResponse.json({ ok: true, updated });
}
