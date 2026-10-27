"use client";

import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Agent, AgentRole } from "@/lib/supabase/types";

const ERR_PT: Record<string, string> = {
  unauthorized: "Sessão expirada. Faça login de novo.",
  forbidden: "Só admins podem gerenciar agentes.",
  email_ja_usado: "Esse e-mail já está em uso por outra conta.",
  nao_pode_excluir_voce: "Você não pode excluir a sua própria conta.",
  nao_pode_rebaixar_voce: "Você não pode rebaixar o seu próprio papel.",
  ultimo_admin: "Não dá pra excluir o último admin — promova outro antes.",
  agente_nao_encontrado: "Agente não encontrado.",
  invalid_payload: "Confira os dados informados.",
  auth_create_failed: "Não foi possível criar o login. Verifique o e-mail e a senha (mín. 6 caracteres).",
  already_agent: "Essa pessoa já é agente aqui.",
  rate_limited: "Muitas criações seguidas. Espere um pouco e tente de novo.",
};
const tr = (e?: string) => (e ? ERR_PT[e] ?? e : "Erro inesperado.");

export function AgentsAdmin({ initial }: { initial: Agent[] }) {
  const [agents, setAgents] = useState<Agent[]>(initial);

  // criar
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AgentRole>("agent");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // editar / excluir
  const [editing, setEditing] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setErr(tr(e.error));
      setBusy(false);
      return;
    }
    const { agent, reused } = (await res.json()) as { agent: Agent; reused?: boolean };
    setAgents((prev) => [...prev, agent]);
    setName(""); setEmail(""); setPassword(""); setRole("agent");
    setOpen(false);
    setBusy(false);
    if (reused) {
      // Conta de login já existia neste projeto. Não trocamos a senha dela —
      // avisa o admin pra orientar o acesso corretamente.
      window.alert(
        "Esse e-mail já tinha uma conta de login neste sistema, então vinculei a conta existente como agente.\n\nImportante: a pessoa entra com a senha que já tinha — a senha provisória que você digitou foi ignorada. Se ela não lembrar, defina uma nova senha aqui mesmo, no botão de editar.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Agentes</h1>
          <p className="text-sm text-muted-foreground">Quem pode acessar o painel de atendimento.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Novo agente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar agente</DialogTitle>
              <DialogDescription>O agente receberá acesso ao painel com o e-mail e senha definidos.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="a-name">Nome</Label>
                <Input id="a-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-email">E-mail</Label>
                <Input id="a-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-pwd">Senha provisória</Label>
                <Input id="a-pwd" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-role">Papel</Label>
                <select
                  id="a-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AgentRole)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="agent">Atendente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Papel</th>
              <th className="px-4 py-2">Criado em</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{a.email}</td>
                <td className="px-4 py-2">
                  <Badge variant={a.role === "admin" ? "default" : "muted"}>{a.role}</Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(a)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(a)}
                      title="Excluir"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum agente ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditAgentDialog
          agent={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setAgents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteAgentDialog
          agent={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setAgents((prev) => prev.filter((x) => x.id !== id));
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

// ── Editar ──────────────────────────────────────────────────────
function EditAgentDialog({
  agent,
  onClose,
  onSaved,
}: {
  agent: Agent;
  onClose: () => void;
  onSaved: (a: Agent) => void;
}) {
  const [name, setName] = useState(agent.name ?? "");
  const [email, setEmail] = useState(agent.email ?? "");
  const [role, setRole] = useState<AgentRole>(agent.role);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, ...(password ? { password } : {}) }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setErr(tr(e.error));
      setBusy(false);
      return;
    }
    const { agent: updated } = (await res.json()) as { agent: Agent };
    setBusy(false);
    onSaved(updated);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar agente</DialogTitle>
          <DialogDescription>Altere os dados ou defina uma nova senha de acesso.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Nome</Label>
            <Input id="e-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-email">E-mail</Label>
            <Input id="e-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-role">Papel</Label>
            <select
              id="e-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AgentRole)}
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="agent">Atendente</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-pwd">Nova senha (opcional)</Label>
            <Input
              id="e-pwd"
              type="password"
              minLength={6}
              placeholder="Deixe em branco para manter a atual"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Excluir ─────────────────────────────────────────────────────
function DeleteAgentDialog({
  agent,
  onClose,
  onDeleted,
}: {
  agent: Agent;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/agents/${agent.id}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setErr(tr(e.error));
      setBusy(false);
      return;
    }
    setBusy(false);
    onDeleted(agent.id);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir agente</DialogTitle>
          <DialogDescription>
            Remover <strong>{agent.name}</strong> ({agent.email})? Ele perde o acesso ao painel na hora.
            As conversas e mensagens antigas são mantidas no histórico. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir agente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
