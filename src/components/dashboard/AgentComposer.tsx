"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CornerUpLeft, FileText, Image as ImageIcon, Loader2, Paperclip, SendHorizontal,
  UploadCloud, Video, Volume2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioRecorder } from "./AudioRecorder";
import { QuickReplyPicker } from "./QuickReplyPicker";
import { cn, formatBytes } from "@/lib/utils";
import type { Attachment } from "@/lib/supabase/types";

type Props = {
  conversationId: string;
  supabase: SupabaseClient;
  agentId: string;
  /** Mensagem sendo respondida (barra de citação acima do input). */
  replyTo?: { id: string; authorName: string; preview: string } | null;
  onCancelReply?: () => void;
};

const MAX_BYTES = 25 * 1024 * 1024;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "support-attachments";

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Volume2;
  return FileText;
}

export function AgentComposer({ conversationId, supabase, agentId, replyTo, onCancelReply }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [qrOpen, setQrOpen] = useState(false); // respostas rápidas (abre por botão ou "/")
  const [dragOver, setDragOver] = useState(false);
  const [recorderActive, setRecorderActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = text.trim().length > 0 || pending.length > 0;

  const addFiles = useCallback((list: FileList | null | File[]) => {
    if (!list) return;
    const arr = Array.isArray(list) ? list : Array.from(list);
    const ok: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_BYTES) {
        alert(`"${f.name}" excede 25MB.`);
        continue;
      }
      ok.push(f);
    }
    setPending((p) => [...p, ...ok]);
  }, []);

  const uploadOne = useCallback(
    async (file: File): Promise<Attachment | null> => {
      const path = `agent/${agentId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        alert(`Falha ao subir ${file.name}: ${error.message}`);
        return null;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { url: pub.publicUrl, mime: file.type, name: file.name, size: file.size };
    },
    [supabase, agentId],
  );

  const sendMessage = useCallback(async (extraFiles: File[] = []) => {
    const trimmed = text.trim();
    const allFiles = [...pending, ...extraFiles];
    if (!trimmed && allFiles.length === 0) return;

    setSending(true);
    const uploaded: Attachment[] = [];
    for (const f of allFiles) {
      const a = await uploadOne(f);
      if (a) uploaded.push(a);
    }

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      author_type: "agent",
      author_id: agentId,
      body: trimmed || null,
      attachments: uploaded,
      reply_to_id: replyTo?.id ?? null,
    });

    if (error) {
      alert(`Erro ao enviar: ${error.message}`);
      setSending(false);
      return;
    }

    setText("");
    setPending([]);
    setSending(false);
    // A citação vale por UMA mensagem, como nos apps de mensagem.
    onCancelReply?.();
    requestAnimationFrame(() => textRef.current?.focus());
  }, [text, pending, supabase, conversationId, agentId, uploadOne, replyTo, onCancelReply]);

  // Ao escolher "Responder", o foco vai pro input — a pessoa já digita.
  useEffect(() => {
    if (replyTo) textRef.current?.focus();
  }, [replyTo]);

  const sendAudio = useCallback(async (file: File) => {
    await sendMessage([file]);
  }, [sendMessage]);

  // Quando escolhe uma resposta rápida: injeta o texto no input e os anexos
  // já uploadados (URLs públicas, sem precisar re-upload).
  const insertQuickReply = useCallback((body: string, atts: Attachment[]) => {
    if (body) {
      setText((prev) => (prev ? `${prev}\n${body}` : body));
    }
    if (atts.length > 0) {
      // Anexos do quick reply já têm URL pública — convertemos em pseudo-Files?
      // Não — enviamos direto via insert sem re-upload. Pra isso, envia inline.
      void sendQuickReplyAttachments(atts);
    }
    requestAnimationFrame(() => textRef.current?.focus());
  }, []);

  // Atalho: envia anexos do quick reply num send único (sem subir de novo).
  // Se houver texto pendente, ele é mantido pra o agente revisar/enviar manual.
  const sendQuickReplyAttachments = useCallback(async (atts: Attachment[]) => {
    if (atts.length === 0) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      author_type: "agent",
      author_id: agentId,
      body: null,
      attachments: atts,
    });
    setSending(false);
    if (error) alert(`Erro ao enviar anexos: ${error.message}`);
  }, [supabase, conversationId, agentId]);

  return (
    <div
      className={cn(
        "relative border-t border-border/40 bg-card px-4 py-2.5 space-y-2",
        dragOver && "ring-2 ring-inset ring-primary",
      )}
      onPaste={(e) => addFiles(e.clipboardData.files)}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragOver(true); }}
      onDragLeave={(e) => {
        // só remove se sair de fato do container
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <UploadCloud className="h-8 w-8" />
            <span className="text-sm font-medium">Solte para anexar</span>
          </div>
        </div>
      )}

      {replyTo && (
        <div className="flex items-center gap-2 rounded-md border-l-[3px] border-l-primary bg-secondary/60 px-2.5 py-1.5">
          <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold text-primary">
              Respondendo {replyTo.authorName}
            </div>
            <div className="truncate text-xs text-muted-foreground">{replyTo.preview}</div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancelar resposta"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {pending.length > 0 && !recorderActive && (
        <div className="flex flex-wrap gap-1.5">
          {pending.map((f, i) => {
            const Icon = fileIcon(f.type);
            return (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-[180px] truncate">{f.name}</span>
                <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {/* Quando recorder ESTÁ ativo, ele ocupa a linha toda — escondemos o resto */}
        {!recorderActive && (
          <>
            <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} disabled={sending} aria-label="Anexar arquivo">
              <Paperclip className="h-4 w-4" />
            </Button>
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

            <QuickReplyPicker onPick={insertQuickReply} open={qrOpen} onOpenChange={setQrOpen} />

            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => {
                const v = e.target.value;
                // "/" como 1º caractere abre as respostas rápidas (sem digitar o "/")
                if (v === "/" && text.length === 0) {
                  setQrOpen(true);
                  return;
                }
                setText(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Digite uma mensagem"
              className="flex-1 resize-none rounded-lg border border-border/60 bg-background px-3.5 py-2.5 text-[14.5px] leading-[1.4] placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-h-32"
              disabled={sending}
            />
          </>
        )}

        {/* Quando tem texto/arquivos: botão SEND. Senão: botão MIC. */}
        {/* Durante recording/preview: AudioRecorder se expande sozinho. */}
        {hasContent && !recorderActive ? (
          <Button
            onClick={() => void sendMessage()}
            disabled={sending}
            size="icon"
            aria-label="Enviar"
            className="rounded-full"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        ) : (
          <AudioRecorder onSend={sendAudio} onActiveChange={setRecorderActive} />
        )}
      </div>
    </div>
  );
}
