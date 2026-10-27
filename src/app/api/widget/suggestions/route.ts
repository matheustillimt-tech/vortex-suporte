import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/widget-token";
import { isProjectKeyValid, getExpectedProjectKey } from "@/lib/widget-project";

export const runtime = "nodejs";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

// GET — lista as sugestões APROVADAS + as pendentes do próprio autor
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectKey = searchParams.get("project") ?? getExpectedProjectKey();
  if (!isProjectKeyValid(projectKey)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 401 });
  }

  const session = verifySession(bearer(req));
  const supabase = createAdminClient();

  // Só o que passou pela moderação vira lista pública. Este client é o de
  // service_role (ignora RLS), então o filtro AQUI é o que segura a barreira.
  const { data: suggestions } = await supabase
    .from("suggestions")
    .select("*")
    .eq("project_key", projectKey)
    .eq("moderation_status", "approved")
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  // O autor continua vendo a própria ideia enquanto ela espera análise —
  // sem isso ele acha que o envio falhou e manda de novo.
  let pendingMine: typeof suggestions = [];
  if (session) {
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .eq("project_key", projectKey)
      .eq("contact_id", session.contactId)
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    pendingMine = data ?? [];
  }

  let votedIds: string[] = [];
  if (session && suggestions && suggestions.length > 0) {
    const { data: votes } = await supabase
      .from("suggestion_votes")
      .select("suggestion_id")
      .eq("contact_id", session.contactId)
      .in("suggestion_id", suggestions.map((s) => s.id));
    votedIds = (votes ?? []).map((v) => v.suggestion_id);
  }

  return NextResponse.json({
    suggestions: suggestions ?? [],
    pendingMine: pendingMine ?? [],
    votedIds,
  });
}

// POST — cria sugestão (requer sessão de contato)
const Body = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = verifySession(bearer(req));
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suggestions")
    .insert({
      project_key: session.projectKey,
      contact_id: session.contactId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      // Explícito de propósito: nada enviado pelo cliente nasce publicado.
      // O default da coluna já é 'pending', mas deixar aqui evita que uma
      // mudança de default no banco publique sugestão sem ninguém revisar.
      moderation_status: "pending",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "db_error", details: error.message }, { status: 500 });
  return NextResponse.json({ suggestion: data, pendingApproval: true });
}
