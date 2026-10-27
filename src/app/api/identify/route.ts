import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { signSession } from "@/lib/widget-token";
import { isProjectKeyValid } from "@/lib/widget-project";
import { verifyUserHash, isUserHashRequired } from "@/lib/security/widget-hash";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { widgetCorsHeaders, widgetCorsResponse } from "@/lib/security/cors";

type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export const runtime = "nodejs";

const Body = z.object({
  projectKey: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
  /** HMAC-SHA256(email, WIDGET_VERIFY_SECRET).hex — calculado no servidor do seu site/app */
  userHash: z.string().regex(/^[0-9a-f]{64}$/).optional().nullable(),
});

const MAX = 30; // requisições
const WINDOW = 60; // segundos

export function OPTIONS(req: Request) {
  return widgetCorsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = widgetCorsHeaders(origin);

  // rate limit por IP
  const ip = clientIp(req);
  const rl = rateLimit({ key: `identify:${ip}`, max: MAX, windowSec: WINDOW });
  const rlHeaders = rateLimitHeaders(rl, MAX);

  if (rl.blocked) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...corsHeaders, ...rlHeaders, "Retry-After": String(WINDOW) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: { ...corsHeaders, ...rlHeaders } });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload" },
      { status: 400, headers: { ...corsHeaders, ...rlHeaders } },
    );
  }
  const { projectKey, email, name, externalId, metadata, userHash } = parsed.data;

  if (!isProjectKeyValid(projectKey)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 401, headers: { ...corsHeaders, ...rlHeaders } });
  }

  // VISITANTE: quem chama de uma página sem login (ex.: a tela de login do seu
  // app) — não consegue entrar, ou comprou com o e-mail errado. O seu site não
  // consegue assinar esse e-mail (não sabe se é dele), então:
  //   · não exige userHash;
  //   · NUNCA encosta num contato existente pelo e-mail — só pelo external_id
  //     `visitante:<id>` que o navegador dele gerou. Senão qualquer um digitava
  //     o e-mail de um cliente e lia a conversa dele.
  // O e-mail fica gravado pro atendente ver, com o aviso de "não verificado".
  const visitante = metadata.visitante === true;
  if (visitante && !(externalId && externalId.startsWith("visitante:"))) {
    return NextResponse.json({ error: "visitor_needs_external_id" }, { status: 400, headers: { ...corsHeaders, ...rlHeaders } });
  }

  // Verifica userHash (impede impersonation)
  const verdict = visitante ? "ok" : verifyUserHash(email, userHash);
  if (verdict === "invalid") {
    return NextResponse.json({ error: "invalid_user_hash" }, { status: 401, headers: { ...corsHeaders, ...rlHeaders } });
  }
  if (verdict === "missing") {
    return NextResponse.json(
      { error: "user_hash_required", hint: "Assine identify() no servidor do seu site com HMAC-SHA256 do e-mail (userHash)." },
      { status: 401, headers: { ...corsHeaders, ...rlHeaders } },
    );
  }
  // Log suave quando recomendado e não veio (modo soft)
  if (!visitante && !userHash && !isUserHashRequired() && process.env.WIDGET_VERIFY_SECRET) {
    console.warn(`[identify] sem userHash de ${email} (modo soft)`);
  }

  const supabase = createAdminClient();

  // Procura contato por external_id primeiro, depois por e-mail.
  let existing = null as { id: string; name: string | null } | null;

  if (externalId) {
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("external_id", externalId)
      .maybeSingle();
    existing = data;
  }
  // Pelo e-mail só pra usuário identificado pelo seu site — e ignorando contatos
  // de visitante, que têm e-mail NÃO verificado (poderia ser o de outra pessoa).
  if (!existing && !visitante) {
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("email", email)
      .or("metadata->>visitante.is.null,metadata->>visitante.neq.true")
      .order("first_seen_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    existing = data;
  }

  const nowIso = new Date().toISOString();
  let contactId: string;
  let contactName: string | null;

  if (existing) {
    const update: ContactUpdate = {
      last_seen_at: nowIso,
      metadata,
      email,
    };
    if (externalId) update.external_id = externalId;
    if (name && !existing.name) update.name = name;

    const { data, error } = await supabase
      .from("contacts")
      .update(update)
      .eq("id", existing.id)
      .select("id, name")
      .single();
    if (error) {
      console.error("[identify] db error:", error.message);
      return NextResponse.json({ error: "db_error" }, { status: 500, headers: { ...corsHeaders, ...rlHeaders } });
    }
    contactId = data.id;
    contactName = data.name;
  } else {
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        email,
        name: name ?? null,
        external_id: externalId ?? null,
        metadata,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
      })
      .select("id, name")
      .single();
    if (error) {
      console.error("[identify] db error:", error.message);
      return NextResponse.json({ error: "db_error" }, { status: 500, headers: { ...corsHeaders, ...rlHeaders } });
    }
    contactId = data.id;
    contactName = data.name;
  }

  const token = signSession({ contactId, projectKey });

  const { data: lastConv } = await supabase
    .from("conversations")
    .select("id, status, first_message_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(
    {
      contactId,
      name: contactName,
      sessionToken: token,
      activeConversation: lastConv ?? null,
    },
    { headers: { ...corsHeaders, ...rlHeaders } },
  );
}
