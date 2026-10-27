import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/widget-token";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { widgetCorsHeaders, widgetCorsResponse } from "@/lib/security/cors";

export const runtime = "nodejs";

const AttachmentSchema = z.object({
  url: z.string().url(),
  mime: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
});

const Body = z.object({
  description: z.string().min(3).max(4000),
  context: z.record(z.unknown()).optional().default({}),
  attachments: z.array(AttachmentSchema).max(10).optional().default([]),
});

const RL_MAX = 5;
const RL_WINDOW = 600; // 5 reports / 10 min

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export function OPTIONS(req: Request) {
  return widgetCorsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = widgetCorsHeaders(origin);

  const session = verifySession(bearer(req));
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });

  const ip = clientIp(req);
  const rl = rateLimit({ key: `bugs:${session.contactId}:${ip}`, max: RL_MAX, windowSec: RL_WINDOW });
  const rlHeaders = rateLimitHeaders(rl, RL_MAX);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...corsHeaders, ...rlHeaders, "Retry-After": String(RL_WINDOW) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: { ...corsHeaders, ...rlHeaders } });
  }
  const { description, context, attachments } = parsed.data;

  const supabase = createAdminClient();

  // Pega dados do contato pra denormalizar
  const { data: contact } = await supabase
    .from("contacts")
    .select("email, name")
    .eq("id", session.contactId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("bug_reports")
    .insert({
      project_key: session.projectKey,
      contact_id: session.contactId,
      reporter_email: contact?.email ?? null,
      reporter_name: contact?.name ?? null,
      description: description.trim(),
      context,
      attachments,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[bugs] db error:", error.message);
    return NextResponse.json({ error: "db_error" }, { status: 500, headers: { ...corsHeaders, ...rlHeaders } });
  }

  return NextResponse.json({ ok: true, id: data.id }, { headers: { ...corsHeaders, ...rlHeaders } });
}
