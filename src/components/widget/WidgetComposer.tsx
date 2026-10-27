"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Paperclip, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { MAX_SUPPORT_FILE_BYTES, SUPPORT_FILE_LIMIT_LABEL } from "@/lib/support-upload-limits";
import { uploadSupportFile, type SignedSupportUpload } from "@/lib/support-upload";
import type { Attachment, Message } from "@/lib/supabase/types";

type Props = {
  conversationId: string;
  sessionToken: string;
  onSent: (msg: Message) => void;
  /** Tema escolhido — só é usado pelo servidor se a mensagem reabrir o atendimento. */
  topicId?: string;
  autoFocus?: boolean;
};


export function WidgetComposer({ conversationId, sessionToken, onSent, topicId, autoFocus }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const completedUploads = useRef(new Map<File, Attachment>());
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list || sendingRef.current) return;
    setError(null);
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_SUPPORT_FILE_BYTES) {
        setError(`Esse arquivo passa do limite de ${SUPPORT_FILE_LIMIT_LABEL}. Compacte ou reduza o arquivo pra enviar.`);
        continue;
      }
      ok.push(f);
    }
    if (pending.length + ok.length > 10) setError("Envie até 10 arquivos por mensagem.");
    setPending((p) => [...p, ...ok].slice(0, 10));
  }, [pending.length]);

  const uploadOne = useCallback(async (file: File): Promise<Attachment> => {
    const cached = completedUploads.current.get(file);
    if (cached) return cached;
    setProgress({ name: file.name, percent: 0 });
    const signRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ mime: file.type, size: file.size, filename: file.name }),
    });
    if (!signRes.ok) throw new Error(signRes.status === 401 ? "Sua sessão expirou. Reabra o suporte e tente novamente." : "Não foi possível preparar o arquivo. Confira o formato e tente novamente.");
    const sign = await signRes.json() as SignedSupportUpload;
    await uploadSupportFile(file, sign, percent => setProgress({ name: file.name, percent }));
    const attachment = { url: sign.publicUrl, mime: file.type, name: file.name, size: file.size };
    completedUploads.current.set(file, attachment);
    return attachment;
  }, [sessionToken]);

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    const trimmed = text.trim();
    if (!trimmed && pending.length === 0) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const uploaded: Attachment[] = [];
      // Se um anexo falhar, preserva o texto e TODOS os arquivos. Anexos já
      // enviados ficam em memória para não reenviar arquivos grandes na nova tentativa.
      for (const file of pending) uploaded.push(await uploadOne(file));
      setProgress(null);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ conversationId, body: trimmed || null, attachments: uploaded, ...(topicId ? { topicId } : {}) }),
      });
      if (!res.ok) throw new Error("Não foi possível enviar a mensagem. Seus arquivos continuam selecionados para tentar novamente.");
      const { message } = await res.json() as { message: Message };
      onSent(message);
      setText("");
      setPending([]);
      completedUploads.current.clear();
      requestAnimationFrame(() => textRef.current?.focus());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha de conexão. Tente novamente.");
    } finally {
      setProgress(null);
      setSending(false);
      sendingRef.current = false;
    }
  }, [text, pending, sessionToken, conversationId, uploadOne, onSent, topicId]);

  return (
    <div
      className="border-t bg-card p-3 space-y-2"
      onPaste={(e) => addFiles(e.clipboardData.files)}
      onDrop={(e) => {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      <p className="text-[11px] text-muted-foreground">Arquivos de até {SUPPORT_FILE_LIMIT_LABEL} cada.</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {progress && <div role="status" className="space-y-1 text-xs">
        <p className="truncate">Enviando {progress.name}: {progress.percent}%</p>
        <progress className="h-2 w-full" value={progress.percent} max={100} aria-label="Progresso do envio" />
      </div>}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pending.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs">
              <span className="max-w-[120px] truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              <button
                disabled={sending}
                aria-label={`Remover ${f.name}`}
                onClick={() => { completedUploads.current.delete(f); setPending((p) => p.filter((_, j) => j !== i)); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <Button aria-label="Anexar arquivo" variant="ghost" size="icon" onClick={() => fileInput.current?.click()} disabled={sending}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <textarea
          ref={textRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Escreva sua mensagem..."
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-h-28"
          disabled={sending}
        />

        <Button onClick={() => void send()} size="icon" disabled={sending || (!text.trim() && pending.length === 0)}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
