import { requireAdmin } from "@/lib/auth/current-agent";

// Gate único pra todas as páginas /admin/*.
// Antes, cada página fazia 2 queries duplicadas (auth.getUser + agents).
// Agora: a checagem roda 1x aqui, e o cache em getCurrentAgent compartilha
// o resultado com a layout do dashboard (já consultado lá).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
