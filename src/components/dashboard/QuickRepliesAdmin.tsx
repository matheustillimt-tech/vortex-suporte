"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  FileText, ImageIcon, Loader2, Pencil, Plus, Trash2, Video, Volume2, Wand2, X, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AudioRecorder } from "./AudioRecorder";
import { cn, formatBytes } from "@/lib/utils";
import type { Attachment, QuickReply } from "@/lib/supabase/types";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "support-attachments";
const MAX_BYTES = 25 * 1024 * 1024;

function attachmentIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Volume2;
  return FileText;
}

type Props = {
  initial: QuickReply[];
  agent: { id: string; name: string; role: "agent" | "admin" };
};

export function QuickRepliesAdmin({ initial, agent }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<QuickReply[]>(initial);
  const [tab, setTab] = useState<"all" | "mine">("mine");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);

  const filtered = items.filter((r) => {
    if (tab === "mine" && r.author_id !== agent.id) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (
        !r.title.toLowerCase().includes(q) &&
        !r.shortcut?.toLowerCase().includes(q) &&
        !r.body?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const counts = {
    all: items.length,
    mine: items.filter((r) => r.author_id === agent.id).length,
  };

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(r: QuickReply) {
    setEditing(r);
    setOpen(true);
  }

  async function remove(r: QuickReply) {
    if (!confirm(`Excluir a resposta rápida "${r.title}"?`)) return;
    const { error } = await supabase.from("quick_replies").delete().eq("id", r.id);
    if (error) return alert(error.message);
    setItems((p) => p.filter((x) => x.id !== r.id));
  }

  function handleSaved(saved: QuickReply, wasEditing: boolean) {
    setItems((p) => (wasEditing ? p.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...p]));
    setOpen(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Respostas rápidas
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelos de texto + mídia que aparecem na composer. Use o atalho <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/</code> ou o botão ⚡ no chat.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nova resposta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <QuickReplyForm
              key={editing?.id ?? "new"}
              initial={editing}
              agentId={agent.id}
              onSaved={handleSaved}
            />
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "mine")}>
          <TabsList className="h-9 bg-secondary/60">
            <TabsTrigger value="mine" className="h-7 px-3 text-xs">
              Minhas <Count n={counts.mine} />
            </TabsTrigger>
            <TabsTrigger value="all" className="h-7 px-3 text-xs">
              Todas <Count n={counts.all} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, atalho ou texto…"
          className="h-9 flex-1 min-w-[180px] bg-background"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          <Wand2 className="h-7 w-7" />
          <p>
            {query
              ? `Sem resultados pra "${query}".`
              : tab === "mine"
              ? "Você ainda não criou respostas rápidas."
              : "Sem respostas rápidas ainda."}
          </p>
          {!query && (
            <Button onClick={openCreate} variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Criar a primeira
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <ReplyRow
              key={r.id}
              r={r}
              canEdit={r.author_id === agent.id || agent.role === "admin"}
              onEdit={() => openEdit(r)}
              onDelete={() => remove(r)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="ml-1.5 rounded bg-primary/20 px-1 text-[9px] font-semibold text-primary">{n}</span>;
}

function ReplyRow({
  r, canEdit, onEdit, onDelete,
}: { r: QuickReply; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <div className="rounded-md bg-primary/10 p-2 text-primary">
        <Zap className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{r.title}</span>
          {r.shortcut && (
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">/{r.shortcut}</code>
          )}
          {r.attachments.length > 0 && (
            <Badge variant="muted" className="text-[10px]">{r.attachments.length} anexo{r.attachments.length > 1 ? "s" : ""}</Badge>
          )}
        </div>
        {r.body && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">{r.body}</p>
        )}
        {r.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.attachments.slice(0, 3).map((a, i) => {
              const Icon = attachmentIcon(a.mime);
              return (
                <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px]">
                  <Icon className="h-3 w-3 text-muted-foreground" /> {a.name}
                </span>
              );
            })}
            {r.attachments.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{r.attachments.length - 3}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-0.5">
        {canEdit ? (
          <>
            <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <span className="px-2 text-[10px] text-muted-foreground self-center">só leitura</span>
        )}
      </div>
    </li>
  );
}

// =====================================================================
// Form
// =====================================================================

function QuickReplyForm({
  initial, agentId, onSaved,
}: {
  initial: QuickReply | null;
  agentId: string;
  onSaved: (r: QuickReply, wasEditing: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const isEditing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [shortcut, setShortcut] = useState(initial?.shortcut ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const arr = Array.isArray(list) ? list : Array.from(list);
    const ok: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_BYTES) { alert(`"${f.name}" excede 25MB`); continue; }
      ok.push(f);
    }
    setPendingFiles((p) => [...p, ...ok]);
  }

  async function uploadOne(file: File): Promise<Attachment | null> {
    const path = `quick-replies/${agentId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (error) { alert(`Falha ao subir ${file.name}: ${error.message}`); return null; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: pub.publicUrl, mime: file.type, name: file.name, size: file.size };
  }

  const handleAudio = useCallback(async (file: File) => {
    const att = await uploadOne(file);
    if (att) setAttachments((p) => [...p, att]);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const uploaded: Attachment[] = [];
    for (const f of pendingFiles) {
      const a = await uploadOne(f);
      if (a) uploaded.push(a);
    }
    const finalAttachments = [...attachments, ...uploaded];

    const payload = {
      title: title.trim(),
      shortcut: shortcut.trim() || null,
      body: body.trim() || null,
      attachments: finalAttachments,
    };

    if (isEditing && initial) {
      const { data, error } = await supabase
        .from("quick_replies").update(payload).eq("id", initial.id).select("*").single();
      setBusy(false);
      if (error) return setError(error.message);
      onSaved(data as QuickReply, true);
    } else {
      const { data, error } = await supabase
        .from("quick_replies").insert({ ...payload, author_id: agentId }).select("*").single();
      setBusy(false);
      if (error) return setError(error.message);
      onSaved(data as QuickReply, false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Editar resposta rápida" : "Nova resposta rápida"}</DialogTitle>
        <DialogDescription>
          Crie um modelo reutilizável de texto + mídia. Será mostrado pra todos os atendentes.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto scroll-thin pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="qr-title">Título *</Label>
            <Input
              id="qr-title"
              required
              placeholder='"Saudação inicial"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr-shortcut">Atalho</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/</span>
              <Input
                id="qr-shortcut"
                placeholder="oi"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value.replace(/^\/+/, "").toLowerCase())}
                className="pl-6"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qr-body">Texto da mensagem</Label>
          <textarea
            id="qr-body"
            rows={4}
            placeholder="Olá! Aqui é {{nome}} do suporte, como posso ajudar?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-[11px] text-muted-foreground">
            Você pode usar quebras de linha. (Variáveis dinâmicas vêm em breve.)
          </p>
        </div>

        {/* Anexos */}
        <div className="space-y-1.5">
          <Label>Anexos</Label>

          {(attachments.length > 0 || pendingFiles.length > 0) && (
            <ul className="space-y-1.5">
              {attachments.map((a, i) => {
                const Icon = attachmentIcon(a.mime);
                return (
                  <li key={`a-${i}`} className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
              {pendingFiles.map((f, i) => {
                const Icon = attachmentIcon(f.type);
                return (
                  <li key={`p-${i}`} className="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-background px-2.5 py-1.5 text-xs">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                    <Badge variant="muted" className="text-[9px]">pendente</Badge>
                    <button
                      type="button"
                      onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Plus className="h-3.5 w-3.5" /> Anexar arquivo / imagem / vídeo
            </Button>
            <AudioRecorder onSend={handleAudio} />
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,audio/*,application/pdf,text/csv,text/plain,.xlsx,.xls,.doc,.docx,.zip"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            Imagens, vídeos, áudios e documentos até 25MB. Áudio grava direto pelo botão de mic.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy || !title.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Salvar alterações" : "Criar resposta rápida"}
        </Button>
      </form>
    </>
  );
}
