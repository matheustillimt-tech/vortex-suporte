"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/shared/Logo";
import { Bug, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  sessionToken: string;
  initialContext: string;
  onDone: () => void;
};

export function BugReportForm({ sessionToken, initialContext, onDone }: Props) {
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 3) return;
    setSending(true);
    setError(null);

    const context: Record<string, unknown> = {};
    if (typeof window !== "undefined") {
      context.userAgent = navigator.userAgent;
      context.language = navigator.language;
      context.screen = `${window.screen.width}x${window.screen.height}`;
      try {
        const origin = window.location.ancestorOrigins?.[0];
        if (origin) context.origin = origin;
      } catch { /* */ }
      if (initialContext) context.notes = initialContext;
    }

    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ description: description.trim(), context }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error === "rate_limited"
          ? "Você enviou muitos reports. Tente em alguns minutos."
          : "Não foi possível enviar. Tente novamente.");
        setSending(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-emerald-500/15 p-4 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Obrigado pelo report! 🙏</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
            Nossa equipe técnica recebeu e vai investigar. Se for crítico,
            entre em contato pelo chat também.
          </p>
        </div>
        <Button onClick={onDone} variant="outline" size="sm">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto scroll-thin">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className="rounded-full bg-red-500/15 p-2.5 text-red-400">
          <Bug className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Reportar bug</h3>
          <p className="text-xs text-muted-foreground">
            Conta o que aconteceu. Vamos investigar e voltar a você.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <div className="space-y-1.5">
          <Label htmlFor="bug-desc">O que aconteceu?</Label>
          <textarea
            id="bug-desc"
            rows={6}
            autoFocus
            placeholder="Descreva o problema. O que você tentou fazer? Qual mensagem de erro apareceu?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
            minLength={3}
            maxLength={4000}
          />
          <p className="text-[11px] text-muted-foreground">
            Quanto mais detalhes melhor. Não precisa de educadinho — escreva do jeito que sai.
          </p>
        </div>

        <p className="rounded-md border border-border/60 bg-background px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <BrandLogo size={14} alt="" className="mr-1 inline rounded-sm" />
          Vamos coletar automaticamente: seu e-mail, navegador, tela, idioma e
          os dados que o site mandou sobre você. Sem screenshots a menos que você queira anexar.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onDone} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={sending || description.trim().length < 3} className="flex-1">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar report
          </Button>
        </div>
      </form>
    </div>
  );
}
