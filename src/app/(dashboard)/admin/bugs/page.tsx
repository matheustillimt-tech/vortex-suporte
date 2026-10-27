import { createClient } from "@/lib/supabase/server";
import { BugsAdmin } from "@/components/dashboard/BugsAdmin";
import type { BugReport } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BugsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bug_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <BugsAdmin initial={(data ?? []) as BugReport[]} />
    </div>
  );
}
