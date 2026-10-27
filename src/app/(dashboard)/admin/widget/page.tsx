import { createClient } from "@/lib/supabase/server";
import { PROJECT_KEY } from "@/lib/widget-project";
import { LabelsAdmin } from "@/components/dashboard/LabelsAdmin";
import { WidgetSettingsForm } from "@/components/dashboard/WidgetSettingsForm";
import type { WidgetSettings } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function WidgetSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("widget_settings")
    .select("*")
    .eq("project_key", PROJECT_KEY)
    .maybeSingle();

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <WidgetSettingsForm initial={settings as WidgetSettings | null} />
      <LabelsAdmin />
    </div>
  );
}
