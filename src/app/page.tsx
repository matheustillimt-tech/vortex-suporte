import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 auth-bg">
      <Logo size={56} showText={false} />

      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {BRAND.name} <span className="brand-gradient-text">Suporte</span>
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Plataforma interna de atendimento ao cliente. Acesse o painel para gerenciar conversas em tempo real.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 glow-primary transition"
        >
          Entrar no painel <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/widget"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted/40 transition"
        >
          <MessageCircle className="h-4 w-4" /> Abrir widget (debug)
        </Link>
      </div>
    </main>
  );
}
