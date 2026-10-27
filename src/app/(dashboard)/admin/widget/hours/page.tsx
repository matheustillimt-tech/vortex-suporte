import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_KEY } from "@/lib/widget-project";
import { BusinessHoursAdmin } from "@/components/dashboard/BusinessHoursAdmin";
import { OfflineSettingsForm } from "@/components/dashboard/OfflineSettingsForm";
import type { BusinessHours, Department, WidgetSettings } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BusinessHoursPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("agents").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/inbox");

  const [{ data: deps }, { data: hours }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("departments").select("*").order("name"),
    supabase.from("business_hours").select("*"),
    supabase.from("widget_settings").select("project_key,offline_message,timezone").eq("project_key", PROJECT_KEY).maybeSingle(),
  ]);

  if (settingsError) throw new Error("Não foi possível carregar a mensagem de atendimento.");

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <BusinessHoursAdmin
        departments={(deps ?? []) as Department[]}
        initialHours={(hours ?? []) as BusinessHours[]}
      />
      <OfflineSettingsForm initial={settings as Pick<WidgetSettings, "project_key" | "offline_message" | "timezone"> | null} />
    </div>
  );
}
