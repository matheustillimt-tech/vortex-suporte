import { createClient } from "@/lib/supabase/server";
import { CloseReasonsAdmin } from "@/components/dashboard/CloseReasonsAdmin";
import type { CloseReason } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CloseReasonsPage() {
  const supabase = await createClient();
  const { data: reasons } = await supabase
    .from("close_reasons")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <CloseReasonsAdmin initial={(reasons ?? []) as CloseReason[]} />
    </div>
  );
}
