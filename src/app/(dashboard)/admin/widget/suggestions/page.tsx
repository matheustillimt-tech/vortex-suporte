import { createClient } from "@/lib/supabase/server";
import { PROJECT_KEY } from "@/lib/widget-project";
import { requireAdmin } from "@/lib/auth/current-agent";
import { SuggestionsAdmin } from "@/components/dashboard/SuggestionsAdmin";
import type { Suggestion } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SuggestionsAdminPage() {
  // Quem moderou fica registrado em moderated_by.
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("suggestions")
    .select("*")
    .eq("project_key", PROJECT_KEY)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <SuggestionsAdmin initial={(data ?? []) as Suggestion[]} agentId={admin.id} />
    </div>
  );
}
