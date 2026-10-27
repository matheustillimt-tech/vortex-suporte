import { Loader2 } from "lucide-react";

// Aparece INSTANTANEAMENTE ao navegar entre páginas do dashboard.
// O layout (sidebar) fica mounted; só o content swap mostra esse spinner.
export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando…
      </div>
    </div>
  );
}
