"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { CloseReason } from "@/lib/supabase/types";

export function CloseReasonsAdmin({ initial }: { initial: CloseReason[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<CloseReason[]>(initial);
  const [openCreate, setOpenCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  function sorted(arr: CloseReason[]) {
    return [...arr].sort((a, b) =>
      a.sort_order - b.sort_order || a.label.localeCompare(b.label),
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const next_order = items.length === 0 ? 10 : Math.max(...items.map((i) => i.sort_order)) + 10;
    const { data, error } = await supabase
      .from("close_reasons")
      .insert({ label: label.trim(), sort_order: next_order, enabled: true })
      .select("*")
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    setItems((p) => sorted([...p, data as CloseReason]));
    setLabel("");
    setOpenCreate(false);
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = editingLabel.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("close_reasons")
      .update({ label: trimmed })
      .eq("id", editingId);
    if (error) return alert(error.message);
    setItems((p) => sorted(p.map((x) => (x.id === editingId ? { ...x, label: trimmed } : x))));
    setEditingId(null);
    setEditingLabel("");
  }

  async function toggleEnabled(r: CloseReason) {
    const { error } = await supabase
      .from("close_reasons")
      .update({ enabled: !r.enabled })
      .eq("id", r.id);
    if (error) return alert(error.message);
    setItems((p) => p.map((x) => (x.id === r.id ? { ...x, enabled: !r.enabled } : x)));
  }

  async function move(r: CloseReason, dir: "up" | "down") {
    const idx = items.findIndex((x) => x.id === r.id);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= items.length) return;
    const other = items[swap];
    // Troca os sort_orders
    await Promise.all([
      supabase.from("close_reasons").update({ sort_order: other.sort_order }).eq("id", r.id),
      supabase.from("close_reasons").update({ sort_order: r.sort_order }).eq("id", other.id),
    ]);
    setItems((p) =>
      sorted(
        p.map((x) =>
          x.id === r.id ? { ...x, sort_order: other.sort_order } :
          x.id === other.id ? { ...x, sort_order: r.sort_order } : x,
        ),
      ),
    );
  }

  async function remove(r: CloseReason) {
    if (!confirm(`Excluir o motivo "${r.label}"?\n\nAtendimentos antigos mantêm o nome no histórico (snapshot).`)) return;
    const { error } = await supabase.from("close_reasons").delete().eq("id", r.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== r.id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Motivos de finalização</h1>
          <p className="text-sm text-muted-foreground">
            A lista que aparece pra atendente ao clicar "Finalizar". A opção
            "Outros" (com texto livre) sempre aparece automaticamente.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Novo motivo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar motivo</DialogTitle>
              <DialogDescription>
                Use rótulos curtos (1-4 palavras) — facilita pra atendente
                escolher rápido.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reason-label">Rótulo</Label>
                <Input
                  id="reason-label" required autoFocus maxLength={80}
                  value={label} onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex.: Pagamento aprovado"
                />
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" className="w-full" disabled={busy || !label.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Tag className="h-8 w-8" />
          <p className="text-sm">Nenhum motivo cadastrado.</p>
          <Button onClick={() => setOpenCreate(true)} variant="outline">
            <Plus className="h-4 w-4" /> Criar o primeiro
          </Button>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card divide-y">
          {items.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 px-4 py-3">
              <div className="rounded-md bg-muted p-2 text-muted-foreground">
                <Tag className="h-4 w-4" />
              </div>

              {editingId === r.id ? (
                <>
                  <Input
                    autoFocus value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") { setEditingId(null); setEditingLabel(""); }
                    }}
                    className="h-9 flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={saveEdit} aria-label="Salvar">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost"
                    onClick={() => { setEditingId(null); setEditingLabel(""); }}
                    aria-label="Cancelar">
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm font-medium ${!r.enabled && "opacity-50 line-through"}`}>
                    {r.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleEnabled(r)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      r.enabled
                        ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {r.enabled ? "Ativo" : "Inativo"}
                  </button>
                  <Button size="icon" variant="ghost" onClick={() => void move(r, "up")}
                    disabled={i === 0} aria-label="Subir">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void move(r, "down")}
                    disabled={i === items.length - 1} aria-label="Descer">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost"
                    onClick={() => { setEditingId(r.id); setEditingLabel(r.label); }}
                    aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void remove(r)}
                    aria-label="Excluir"
                    className="text-destructive hover:text-destructive">
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
