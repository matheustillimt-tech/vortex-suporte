import { createClient } from "@/lib/supabase/server";
import { PROJECT_KEY } from "@/lib/widget-project";
import { UpdatesAdmin } from "@/components/dashboard/UpdatesAdmin";
import type { Update } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function UpdatesAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("updates")
    .select("*")
    .eq("project_key", PROJECT_KEY)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <UpdatesAdmin initial={(data ?? []) as Update[]} />
    </div>
  );
}
