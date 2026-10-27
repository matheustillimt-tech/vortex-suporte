"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Lightbulb, Loader2, Pencil, Plus, Trash2,
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
import { cn } from "@/lib/utils";
import type { Department, SupportTopic } from "@/lib/supabase/types";

type FormState = Omit<SupportTopic, "id" | "created_at" | "sort_order">;

const DEFAULT_FORM: FormState = {
  project_key: PROJECT_KEY,
  name: "",
  description: "",
  icon: "MessageCircle",
  icon_url: null,
  department_id: null,
  auto_message: "",
  enabled: true,
};

export function TopicsAdmin({
  initial, departments,
}: { initial: SupportTopic[]; departments: Department[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<SupportTopic[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupportTopic | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setErr(null);
    setOpen(true);
  }

  function openEdit(t: SupportTopic) {
    setEditing(t);
    setForm({
      project_key: t.project_key,
      name: t.name,
      description: t.description ?? "",
      icon: t.icon,
      icon_url: t.icon_url ?? null,
      department_id: t.department_id,
      auto_message: t.auto_message ?? "",
      enabled: t.enabled,
    });
    setErr(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const payload = {
      ...form,
      description: form.description?.trim() || null,
      auto_message: form.auto_message?.trim() || null,
      icon_url: form.icon_url || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("support_topics").update(payload).eq("id", editing.id).select("*").single();
      setBusy(false);
      if (error) return setErr(error.message);
      setItems((p) => p.map((x) => (x.id === editing.id ? (data as SupportTopic) : x)));
    } else {
      const nextOrder = items.length > 0 ? Math.max(...items.map((x) => x.sort_order)) + 10 : 10;
      const { data, error } = await supabase
        .from("support_topics").insert({ ...payload, sort_order: nextOrder }).select("*").single();
      setBusy(false);
      if (error) return setErr(error.message);
      setItems((p) => [...p, data as SupportTopic]);
    }
    setOpen(false);
  }

  async function remove(t: SupportTopic) {
    if (!confirm(`Excluir "${t.name}"?`)) return;
    const { error } = await supabase.from("support_topics").delete().eq("id", t.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== t.id));
  }

  async function toggleEnabled(t: SupportTopic) {
    const newVal = !t.enabled;
    const { error } = await supabase.from("support_topics").update({ enabled: newVal }).eq("id", t.id);
    if (error) return alert(error.message);
    setItems((p) => p.map((x) => (x.id === t.id ? { ...x, enabled: newVal } : x)));
  }

  async function move(t: SupportTopic, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === t.id);
    const swap = items[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("support_topics").update({ sort_order: swap.sort_order }).eq("id", t.id),
      supabase.from("support_topics").update({ sort_order: t.sort_order }).eq("id", swap.id),
    ]);
    setItems((p) => {
      const next = [...p];
      next[idx] = { ...t, sort_order: swap.sort_order };
      next[idx + dir] = { ...swap, sort_order: t.sort_order };
      return next.sort((a, z) => a.sort_order - z.sort_order);
    });
  }

  const depMap = new Map(departments.map((d) => [d.id, d]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Temas de atendimento</h1>
          <p className="text-sm text-muted-foreground">
            O cliente escolhe um tema ao iniciar o chat. A conversa é roteada para o departamento certo
            e ele recebe uma mensagem inicial automática.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Novo tema</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar tema" : "Novo tema"}</DialogTitle>
              <DialogDescription>
                Cada tema é apresentado como botão no widget. Ao escolher, o cliente vê a mensagem
                automática configurada.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto scroll-thin pr-1">
              <div className="space-y-1.5">
                <Label>Nome do tema</Label>
                <Input
                  required
                  placeholder='Ex: "Problema com pagamento"'
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Descrição curta</Label>
                <Input
                  placeholder="Aparece abaixo do nome no widget"
                  value={form.description ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <IconPicker
                iconName={form.icon}
                iconUrl={form.icon_url}
                accent="primary"
                onChange={({ iconName, iconUrl }) =>
                  setForm((p) => ({ ...p, icon: iconName, icon_url: iconUrl }))
                }
              />

              <div className="space-y-1.5">
                <Label>Departamento responsável</Label>
                <select
                  value={form.department_id ?? ""}
                  onChange={(e) => setForm((p) => ({
                    ...p, department_id: e.target.value || null,
                  }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Qualquer atendente —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Quando preenchido, a conversa entra na fila do setor escolhido.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Mensagem automática inicial</Label>
                <textarea
                  rows={3}
                  placeholder='Ex: "Você foi direcionado para o Suporte. Em instantes te respondemos."'
                  value={form.auto_message ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, auto_message: e.target.value }))}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground">
                  Aparece como primeira mensagem no chat (do tipo "sistema").
                  Deixe em branco pra não enviar nada.
                </p>
              </div>

              {err && <p className="text-sm text-destructive">{err}</p>}

              <Button type="submit" className="w-full" disabled={busy || !form.name.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          <Lightbulb className="h-7 w-7" />
          <p>Nenhum tema criado. Clique em "Novo tema" pra começar.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((t, idx) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3",
                !t.enabled && "opacity-50",
              )}
            >
              <BlockIcon iconName={t.icon} iconUrl={t.icon_url} accent="primary" size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold truncate">{t.name}</span>
                  {t.department_id && depMap.get(t.department_id) && (
                    <Badge variant="muted" className="text-[10px]">{depMap.get(t.department_id)!.name}</Badge>
                  )}
                  {!t.department_id && <Badge variant="muted" className="text-[10px]">Sem setor</Badge>}
                  {t.icon_url && <Badge variant="muted" className="text-[10px]">Ícone custom</Badge>}
                  {!t.enabled && <Badge variant="muted" className="text-[10px]">Desabilitado</Badge>}
                </div>
                {t.description && <div className="text-xs text-muted-foreground truncate">{t.description}</div>}
                {t.auto_message && (
                  <div className="text-[11px] text-muted-foreground/80 truncate italic">"{t.auto_message}"</div>
                )}
              </div>
              <div className="flex gap-0.5">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(t, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={idx === items.length - 1} onClick={() => move(t, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => toggleEnabled(t)} className={cn("text-xs", t.enabled && "text-primary")}>
                  {t.enabled ? "ON" : "OFF"}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t)} className="text-destructive hover:text-destructive">
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
