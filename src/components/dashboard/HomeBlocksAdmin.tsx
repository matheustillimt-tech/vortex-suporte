"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Loader2, Plus, Trash2, Pencil,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_KEY } from "@/lib/widget-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { BlockIcon } from "@/components/shared/BlockIcon";
import { IconPicker } from "./IconPicker";
import { ACTION_LABELS } from "@/lib/widget-meta";
import { cn } from "@/lib/utils";
import type { BlockAccent, BlockAction, HomeBlock } from "@/lib/supabase/types";

const DEFAULT_FORM: Omit<HomeBlock, "id" | "created_at" | "sort_order"> = {
  project_key: PROJECT_KEY,
  title: "",
  description: "",
  icon: "MessageCircle",
  icon_url: null,
  accent: "primary",
  action_type: "open_chat",
  action_value: null,
  enabled: true,
};

export function HomeBlocksAdmin({ initial }: { initial: HomeBlock[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<HomeBlock[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HomeBlock | null>(null);
  const [form, setForm] = useState<typeof DEFAULT_FORM>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setOpen(true);
  }

  function openEdit(b: HomeBlock) {
    setEditing(b);
    setForm({
      project_key: b.project_key,
      title: b.title,
      description: b.description ?? "",
      icon: b.icon,
      icon_url: b.icon_url ?? null,
      accent: b.accent,
      action_type: b.action_type,
      action_value: b.action_value,
      enabled: b.enabled,
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const payload = {
      ...form,
      description: form.description || null,
      icon_url: form.icon_url || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("home_blocks")
        .update(payload)
        .eq("id", editing.id)
        .select("*")
        .single();
      setBusy(false);
      if (error) return alert(error.message);
      setItems((p) => p.map((x) => (x.id === editing.id ? (data as HomeBlock) : x)));
    } else {
      const nextOrder = items.length > 0 ? Math.max(...items.map((x) => x.sort_order)) + 1 : 1;
      const { data, error } = await supabase
        .from("home_blocks")
        .insert({ ...payload, sort_order: nextOrder })
        .select("*")
        .single();
      setBusy(false);
      if (error) return alert(error.message);
      setItems((p) => [...p, data as HomeBlock]);
    }
    setOpen(false);
  }

  async function remove(b: HomeBlock) {
    if (!confirm(`Excluir o bloco "${b.title}"?`)) return;
    const { error } = await supabase.from("home_blocks").delete().eq("id", b.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== b.id));
  }

  async function toggleEnabled(b: HomeBlock) {
    const newVal = !b.enabled;
    const { error } = await supabase.from("home_blocks").update({ enabled: newVal }).eq("id", b.id);
    if (error) return alert(error.message);
    setItems((p) => p.map((x) => (x.id === b.id ? { ...x, enabled: newVal } : x)));
  }

  async function move(b: HomeBlock, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === b.id);
    const swap = items[idx + dir];
    if (!swap) return;
    const ops = await Promise.all([
      supabase.from("home_blocks").update({ sort_order: swap.sort_order }).eq("id", b.id),
      supabase.from("home_blocks").update({ sort_order: b.sort_order }).eq("id", swap.id),
    ]);
    const err = ops.find((x) => x.error)?.error;
    if (err) return alert(err.message);
    setItems((p) => {
      const next = [...p];
      next[idx] = { ...b, sort_order: swap.sort_order };
      next[idx + dir] = { ...swap, sort_order: b.sort_order };
      return next.sort((a, z) => a.sort_order - z.sort_order);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Blocos da Home</h1>
          <p className="text-sm text-muted-foreground">
            CTAs que aparecem na tela inicial do widget. Reordene com as setas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Novo bloco</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar bloco" : "Novo bloco"}</DialogTitle>
              <DialogDescription>
                CTAs aparecem na ordem definida e podem ter diferentes ações.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto scroll-thin pr-1">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={form.description ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <IconPicker
                iconName={form.icon}
                iconUrl={form.icon_url}
                accent={form.accent}
                onChange={({ iconName, iconUrl }) =>
                  setForm((p) => ({ ...p, icon: iconName, icon_url: iconUrl }))
                }
              />

              <div className="space-y-1.5">
                <Label>Cor de fundo (ícones do sistema)</Label>
                <div className="grid grid-cols-6 gap-1.5">
                  {(["primary", "blue", "red", "amber", "purple", "muted"] as BlockAccent[]).map((c) => {
                    const selected = form.accent === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, accent: c }))}
                        className={cn(
                          "h-9 rounded-md border text-[10px] font-medium capitalize transition-colors",
                          selected ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/40",
                        )}
                      >
                        <span
                          className={cn(
                            "block h-full w-full rounded-md",
                            c === "primary" && "bg-primary/15 text-primary",
                            c === "blue" && "bg-blue-500/15 text-blue-400",
                            c === "red" && "bg-red-500/15 text-red-400",
                            c === "amber" && "bg-amber-500/15 text-amber-400",
                            c === "purple" && "bg-purple-500/15 text-purple-400",
                            c === "muted" && "bg-muted text-muted-foreground",
                            "flex items-center justify-center",
                          )}
                        >
                          {c === "primary" ? "Verde" : c === "muted" ? "Neutro" : c}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sem efeito quando você usa uma imagem custom (PNG transparente).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Ação ao clicar</Label>
                <select
                  value={form.action_type}
                  onChange={(e) => setForm((p) => ({ ...p, action_type: e.target.value as BlockAction, action_value: null }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {form.action_type === "open_url" && (
                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input
                    type="url"
                    placeholder="https://ajuda.seu-dominio.com.br"
                    required
                    value={form.action_value ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, action_value: e.target.value }))}
                  />
                </div>
              )}

              {form.action_type === "switch_tab" && (
                <div className="space-y-1.5">
                  <Label>Aba destino</Label>
                  <select
                    value={form.action_value ?? "updates"}
                    onChange={(e) => setForm((p) => ({ ...p, action_value: e.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="chat">Chat</option>
                    <option value="updates">Atualizações</option>
                    <option value="ideas">Sugestões</option>
                  </select>
                </div>
              )}

              {/* preview */}
              <BlockPreview
                form={{ ...form, id: "preview", sort_order: 0, created_at: "" } as HomeBlock}
              />

              <Button type="submit" className="w-full" disabled={busy || !form.title}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhum bloco ainda. Clique em "Novo bloco" pra começar.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((b, idx) => (
            <li
              key={b.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3",
                !b.enabled && "opacity-50",
              )}
            >
              <BlockIcon iconName={b.icon} iconUrl={b.icon_url} accent={b.accent} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold truncate">{b.title}</span>
                  <Badge variant="muted" className="text-[10px]">{ACTION_LABELS[b.action_type]}</Badge>
                  {b.icon_url && <Badge variant="muted" className="text-[10px]">Ícone custom</Badge>}
                  {!b.enabled && <Badge variant="muted" className="text-[10px]">Desabilitado</Badge>}
                </div>
                {b.description && <div className="text-xs text-muted-foreground truncate">{b.description}</div>}
                {b.action_value && <div className="text-[11px] text-muted-foreground font-mono truncate">{b.action_value}</div>}
              </div>
              <div className="flex gap-0.5">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(b, -1)} aria-label="Mover pra cima">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={idx === items.length - 1} onClick={() => move(b, 1)} aria-label="Mover pra baixo">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => toggleEnabled(b)} aria-label="Toggle" className={cn("text-xs", b.enabled && "text-primary")}>
                  {b.enabled ? "ON" : "OFF"}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(b)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(b)} aria-label="Excluir" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockPreview({ form }: { form: HomeBlock }) {
  return (
    <div className="rounded-md border border-dashed bg-background p-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Pré-visualização (como aparece no widget)
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
        <BlockIcon iconName={form.icon} iconUrl={form.icon_url} accent={form.accent} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{form.title || "Título do bloco"}</div>
          {form.description && (
            <div className="text-xs text-muted-foreground truncate">{form.description}</div>
          )}
        </div>
      </div>
    </div>
  );
}
