import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Admin-only — atendente comum não vê.
  const { data: agent } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (agent?.role !== "admin") redirect("/inbox");

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <AdminDashboard />
    </div>
  );
}
