import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProjectKeyValid, getExpectedProjectKey } from "@/lib/widget-project";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectKey = searchParams.get("project") ?? getExpectedProjectKey();
  if (!isProjectKeyValid(projectKey)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("updates")
    .select("*")
    .eq("project_key", projectKey)
    .eq("published", true)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ updates: data ?? [] });
}
