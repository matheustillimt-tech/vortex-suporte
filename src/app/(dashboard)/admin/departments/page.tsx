import { createClient } from "@/lib/supabase/server";
import { DepartmentsAdmin } from "@/components/dashboard/DepartmentsAdmin";
import type { Department } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <DepartmentsAdmin initial={(departments ?? []) as Department[]} />
    </div>
  );
}
