import { InstallSnippets } from "@/components/dashboard/InstallSnippets";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_KEY } from "@/lib/widget-project";
import { BRAND, normalizeHex } from "@/lib/brand";

// O layout admin já cuidou da auth. Lê a cor salva no painel pra já sair no código.
export default async function InstallPage() {
  const host = (process.env.NEXT_PUBLIC_APP_URL || "https://suporte.seu-dominio.com.br").replace(/\/$/, "");
  const projectKey = PROJECT_KEY;
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("widget_settings")
    .select("brand_color")
    .eq("project_key", PROJECT_KEY)
    .maybeSingle();
  const color = normalizeHex(settings?.brand_color) ?? BRAND.color;

  return (
    <div className="h-full overflow-auto scroll-thin p-6">
      <InstallSnippets host={host} projectKey={projectKey} color={color} />
    </div>
  );
}
