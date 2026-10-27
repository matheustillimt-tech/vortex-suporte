"use client";

import { useMemo, useState } from "react";
import { Building2, Loader2, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import type { Department } from "@/lib/supabase/types";

export function DepartmentsAdmin({ initial }: { initial: Department[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Department[]>(initial);
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase
      .from("departments")
      .insert({ name: name.trim() })
      .select("*")
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    setItems((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setOpenCreate(false);
  }

  async function startEdit(d: Department) {
    setEditingId(d.id);
    setEditingName(d.name);
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("departments")
      .update({ name: trimmed })
      .eq("id", editingId);
    if (error) return alert(error.message);
    setItems((p) =>
      p.map((x) => (x.id === editingId ? { ...x, name: trimmed } : x))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setEditingId(null);
    setEditingName("");
  }

  async function remove(d: Department) {
    if (!confirm(`Excluir o departamento "${d.name}"?\n\nAtendimentos vinculados ficam sem departamento.`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", d.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== d.id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Departamentos</h1>
          <p className="text-sm text-muted-foreground">
            Organize sua equipe por área (Suporte, Financeiro, Comercial…).
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Novo departamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar departamento</DialogTitle>
              <DialogDescription>
                Agentes serão atribuíveis a um departamento. Útil pra roteamento futuro.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-name">Nome</Label>
                <Input id="dep-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Building2 className="h-8 w-8" />
          <p className="text-sm">Nenhum departamento criado ainda.</p>
          <Button onClick={() => setOpenCreate(true)} variant="outline">
            <Plus className="h-4 w-4" /> Criar o primeiro
          </Button>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card divide-y">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="rounded-md bg-muted p-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </div>

              {editingId === d.id ? (
                <>
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
                    }}
                    className="h-9 flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={saveEdit} aria-label="Salvar">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setEditingId(null); setEditingName(""); }}
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{d.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(d)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(d)}
                    aria-label="Excluir"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
