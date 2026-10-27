import { createClient } from "@/lib/supabase/server";
import { AgentsAdmin } from "@/components/dashboard/AgentsAdmin";
import type { Agent } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <AgentsAdmin initial={(agents ?? []) as Agent[]} />
    </div>
  );
}
