"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  Eye, EyeOff, Image as ImageIcon, Loader2, Pencil, Pin, PinOff, Plus, Trash2, Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_KEY } from "@/lib/widget-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Update } from "@/lib/supabase/types";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "support-attachments";

const EMPTY: Omit<Update, "id" | "created_at" | "updated_at"> = {
  project_key: PROJECT_KEY,
  title: "",
  excerpt: "",
  body: "",
  cover_image_url: null,
  pinned: false,
  published: true,
  published_at: new Date().toISOString(),
};

export function UpdatesAdmin({ initial }: { initial: Update[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Update[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Update | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(u: Update) {
    setEditing(u);
    setForm({
      project_key: u.project_key,
      title: u.title,
      excerpt: u.excerpt ?? "",
      body: u.body ?? "",
      cover_image_url: u.cover_image_url,
      pinned: u.pinned,
      published: u.published,
      published_at: u.published_at,
    });
    setOpen(true);
  }

  async function uploadCover(file: File) {
    setUploading(true);
    const path = `updates/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) {
      setUploading(false);
      return alert(error.message);
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setForm((p) => ({ ...p, cover_image_url: pub.publicUrl }));
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      ...form,
      excerpt: form.excerpt || null,
      body: form.body || null,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { data, error } = await supabase
        .from("updates").update(payload).eq("id", editing.id).select("*").single();
      setBusy(false);
      if (error) return alert(error.message);
      setItems((p) => sortItems(p.map((x) => (x.id === editing.id ? (data as Update) : x))));
    } else {
      const { data, error } = await supabase
        .from("updates").insert(payload).select("*").single();
      setBusy(false);
      if (error) return alert(error.message);
      setItems((p) => sortItems([...(p), data as Update]));
    }
    setOpen(false);
  }

  async function togglePinned(u: Update) {
    const { error } = await supabase.from("updates").update({ pinned: !u.pinned }).eq("id", u.id);
    if (error) return alert(error.message);
    setItems((p) => sortItems(p.map((x) => (x.id === u.id ? { ...x, pinned: !u.pinned } : x))));
  }
  async function togglePublished(u: Update) {
    const { error } = await supabase.from("updates").update({ published: !u.published }).eq("id", u.id);
    if (error) return alert(error.message);
    setItems((p) => p.map((x) => (x.id === u.id ? { ...x, published: !u.published } : x)));
  }
  async function remove(u: Update) {
    if (!confirm(`Excluir "${u.title}"?`)) return;
    const { error } = await supabase.from("updates").delete().eq("id", u.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== u.id));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Atualizações</h1>
          <p className="text-sm text-muted-foreground">
            Changelog visível na aba "Atualizações" do widget. Pins ficam no topo.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nova atualização</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar atualização" : "Nova atualização"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Resumo (preview no feed)</Label>
                <Input value={form.excerpt ?? ""} onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))} placeholder="Frase curta que aparece no card" />
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo</Label>
                <textarea
                  value={form.body ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  rows={10}
                  placeholder="Texto completo. Suporta quebras de linha e markdown básico (**negrito**, *itálico*, [link](url))."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Imagem de capa</Label>
                {form.cover_image_url ? (
                  <div className="relative overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.cover_image_url} alt="cover" className="max-h-48 w-full object-cover" />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setForm((p) => ({ ...p, cover_image_url: null }))}
                      className="absolute right-2 top-2"
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadCover(f);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Enviando…" : "Enviar imagem"}
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(e) => setForm((p) => ({ ...p, pinned: e.target.checked }))}
                  />
                  Fixar no topo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                  />
                  Publicar
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={busy || !form.title}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Publicar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhuma atualização ainda.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((u) => (
            <li
              key={u.id}
              className={cn(
                "flex gap-4 rounded-xl border bg-card p-4",
                u.pinned && "border-primary/40",
                !u.published && "opacity-60",
              )}
            >
              {u.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.cover_image_url} alt={u.title} className="h-20 w-32 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {u.pinned && <Badge variant="default" className="text-[10px]"><Pin className="mr-1 h-3 w-3" />Fixado</Badge>}
                  <h3 className="text-sm font-semibold truncate">{u.title}</h3>
                  {!u.published && <Badge variant="muted" className="text-[10px]">Rascunho</Badge>}
                </div>
                {u.excerpt && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{u.excerpt}</p>}
                <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                  Publicado em {format(new Date(u.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button size="icon" variant="ghost" onClick={() => togglePinned(u)} aria-label={u.pinned ? "Despinar" : "Fixar"}>
                  {u.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => togglePublished(u)} aria-label="Publicar">
                  {u.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(u)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(u)} className="text-destructive hover:text-destructive" aria-label="Excluir">
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

function sortItems(arr: Update[]): Update[] {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
}
