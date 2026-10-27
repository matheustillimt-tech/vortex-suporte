import { createClient } from "@/lib/supabase/server";
import { QuickRepliesAdmin } from "@/components/dashboard/QuickRepliesAdmin";
import { requireAgent } from "@/lib/auth/current-agent";
import type { QuickReply } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function QuickRepliesPage() {
  const agent = await requireAgent();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quick_replies")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <QuickRepliesAdmin
        initial={(data ?? []) as QuickReply[]}
        agent={{ id: agent.id, name: agent.name, role: agent.role }}
      />
    </div>
  );
}
