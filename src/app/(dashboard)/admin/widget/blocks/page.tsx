import { createClient } from "@/lib/supabase/server";
import { PROJECT_KEY } from "@/lib/widget-project";
import { HomeBlocksAdmin } from "@/components/dashboard/HomeBlocksAdmin";
import type { HomeBlock } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function HomeBlocksPage() {
  const supabase = await createClient();
  const { data: blocks } = await supabase
    .from("home_blocks")
    .select("*")
    .eq("project_key", PROJECT_KEY)
    .order("sort_order", { ascending: true });

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <HomeBlocksAdmin initial={(blocks ?? []) as HomeBlock[]} />
    </div>
  );
}
