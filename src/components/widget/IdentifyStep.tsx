"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Props = {
  initialEmail: string;
  initialName: string;
  onSubmit: (vals: { name: string; email: string }) => Promise<void>;
};

export function IdentifyStep({ initialEmail, initialName, onSubmit }: Props) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) return;
        setBusy(true);
        try {
          await onSubmit({ name: name.trim(), email: email.trim() });
        } finally {
          setBusy(false);
        }
      }}
      className="flex h-full flex-col gap-5 p-6"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Antes de começarmos</h3>
        <p className="text-xs text-muted-foreground">
          Confirme seus dados para que possamos atender você melhor.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="w-name">Seu nome</Label>
        <Input
          id="w-name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="w-email">E-mail de contato</Label>
        <Input
          id="w-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Se o suporte for para outra conta, troque o e-mail aqui.
        </p>
      </div>

      <Button type="submit" disabled={busy || !name.trim() || !email.trim()} className="mt-auto">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Continuar
      </Button>
    </form>
  );
}
