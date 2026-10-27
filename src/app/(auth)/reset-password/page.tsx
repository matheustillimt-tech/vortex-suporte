"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // A rota /auth/confirm já trocou o token por sessão (cookies) e nos mandou
    // pra cá. Se algo falhou, vem ?error=... na URL — mostramos o motivo real.
    const params = new URLSearchParams(window.location.search);
    const errRaw = params.get("error") || new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
    if (errRaw) {
      const friendly = /expired|otp_expired|invalid|link_invalido|consumed|not found/i.test(errRaw)
        ? "Esse link expirou ou já foi usado. Peça um novo abaixo."
        : decodeURIComponent(errRaw);
      setLinkError(friendly);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("A senha precisa de no mínimo 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");

    setBusy(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (upErr) {
      setError(upErr.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.replace("/inbox");
      router.refresh();
    }, 1500);
  }

  if (!ready) {
    return (
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm text-center text-sm text-muted-foreground">
        Validando link...
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          {linkError ?? "Solicite um novo link de recuperação de senha."}
        </p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Pedir novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Senha atualizada</h1>
        <p className="text-sm text-muted-foreground">Você já está logado. Redirecionando…</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handle}
      className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Nova senha</h1>
          <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Senha</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirmar senha</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Atualizar senha
      </Button>
    </form>
  );
}
