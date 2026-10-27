import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/widget-token";

export const runtime = "nodejs";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

// POST — toggle vote
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = verifySession(bearer(req));
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = createAdminClient();

  // Sugestão que ainda não passou pela moderação não recebe voto — senão dava
  // pra inflar uma ideia que nem chegou a aparecer publicamente.
  const { data: target } = await supabase
    .from("suggestions")
    .select("moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target.moderation_status !== "approved") {
    return NextResponse.json({ error: "not_public" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("suggestion_votes")
    .select("contact_id")
    .eq("suggestion_id", id)
    .eq("contact_id", session.contactId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("suggestion_votes")
      .delete()
      .eq("suggestion_id", id)
      .eq("contact_id", session.contactId);
    return NextResponse.json({ voted: false });
  }
  await supabase.from("suggestion_votes").insert({ suggestion_id: id, contact_id: session.contactId });
  return NextResponse.json({ voted: true });
}
