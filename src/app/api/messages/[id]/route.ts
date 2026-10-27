import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/widget-token";
import { widgetCorsHeaders, widgetCorsResponse } from "@/lib/security/cors";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return widgetCorsResponse(req.headers.get("origin"));
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

const PatchBody = z.object({
  body: z.string().min(1).max(8000),
});

/**
 * PATCH /api/messages/[id] — edita uma mensagem do widget.
 * Autor precisa ser o mesmo contato da sessão. Body limpa, sem mídia (edição
 * de texto só por enquanto — manter simples). Marca `edited_at`.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const corsHeaders = widgetCorsHeaders(origin);

  const session = verifySession(bearer(req));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400, headers: corsHeaders });
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: corsHeaders });
  }

  const supabase = createAdminClient();
  const { data: msg } = await supabase
    .from("messages")
    .select("id, author_type, author_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (!msg) return NextResponse.json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  if (msg.deleted_at) {
    return NextResponse.json({ error: "deleted" }, { status: 410, headers: corsHeaders });
  }
  if (msg.author_type !== "contact" || msg.author_id !== session.contactId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  const { data: updated, error } = await supabase
    .from("messages")
    .update({ body: parsed.data.body.trim(), edited_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500, headers: corsHeaders });
  }
  return NextResponse.json({ message: updated }, { headers: corsHeaders });
}

/**
 * DELETE /api/messages/[id] — soft-delete da mensagem (widget).
 * Marca deleted_at + deleted_by_*. Mantém attachments/body no banco — só a UI
 * do widget mascara. Dashboard de agente continua vendo histórico original.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const corsHeaders = widgetCorsHeaders(origin);

  const session = verifySession(bearer(req));
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400, headers: corsHeaders });
  }

  const supabase = createAdminClient();
  const { data: msg } = await supabase
    .from("messages")
    .select("id, author_type, author_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (!msg) return NextResponse.json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  if (msg.deleted_at) {
    return NextResponse.json({ ok: true }, { headers: corsHeaders }); // já apagada — idempotente
  }
  if (msg.author_type !== "contact" || msg.author_id !== session.contactId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  // Pega nome do contato pra trilha de moderação
  const { data: contact } = await supabase
    .from("contacts")
    .select("name, email")
    .eq("id", session.contactId)
    .maybeSingle();
  const deletedByName = contact?.name || contact?.email || "Cliente";

  const { error } = await supabase
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_type: "contact",
      deleted_by_id: session.contactId,
      deleted_by_name: deletedByName,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500, headers: corsHeaders });
  }
  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
