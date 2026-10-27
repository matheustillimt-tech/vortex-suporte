import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { Logo } from "@/components/shared/Logo";
import { MobileShell } from "@/components/dashboard/MobileShell";
import { requireAgent } from "@/lib/auth/current-agent";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const agent = await requireAgent().catch(() => null);

  if (!agent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo size={48} showText={false} />
        <h1 className="text-xl font-semibold">Conta sem perfil de agente</h1>
        <p className="text-muted-foreground max-w-md">
          Sua conta foi autenticada mas não há um registro em <code className="rounded bg-muted px-1.5 py-0.5 text-xs">agents</code> ligado a ela.
          Peça pra um admin executar o seed ou criar seu perfil em <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/admin/agents</code>.
        </p>
        <LogoutButton />
      </div>
    );
  }

  return (
    <MobileShell agent={{ name: agent.name, email: agent.email, role: agent.role }}>
      {children}
    </MobileShell>
  );
}
