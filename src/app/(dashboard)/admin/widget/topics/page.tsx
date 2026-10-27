import { createClient } from "@/lib/supabase/server";
import { TopicsAdmin } from "@/components/dashboard/TopicsAdmin";
import type { Department, SupportTopic } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const supabase = await createClient();
  const [{ data: topics }, { data: departments }] = await Promise.all([
    supabase.from("support_topics").select("*").order("sort_order", { ascending: true }),
    supabase.from("departments").select("*").order("name", { ascending: true }),
  ]);

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <TopicsAdmin
        initial={(topics ?? []) as SupportTopic[]}
        departments={(departments ?? []) as Department[]}
      />
    </div>
  );
}
