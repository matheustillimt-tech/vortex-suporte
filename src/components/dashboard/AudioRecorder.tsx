"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Chamado quando o áudio é confirmado pra envio. */
  onSend: (file: File, durationSec: number) => Promise<void> | void;
  /** Avisa o pai quando o recorder está ativo (gravando ou com preview),
   *  pra ele ocultar o restante do composer (como nos apps de mensagem). */
  onActiveChange?: (active: boolean) => void;
};

function pickMimeType(): string {
  // ordem de preferência — Safari odeia webm/opus
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "audio/webm";
}

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function AudioRecorder({ onSend, onActiveChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // limpa stream quando desmonta
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Avisa pai sobre o estado ativo (gravando ou com preview)
  useEffect(() => {
    onActiveChange?.(recording || preview !== null);
  }, [recording, preview, onActiveChange]);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        setBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setPreview(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      startedAtRef.current = Date.now();
      setRecording(true);

      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startedAtRef.current) / 1000);
      }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Permissão negada";
      setError(`Microfone indisponível: ${msg}`);
    }
  }, [preview]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const cancel = useCallback(() => {
    if (recording) stop();
    setBlob(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setDuration(0);
  }, [preview, recording, stop]);

  const send = useCallback(async () => {
    if (!blob) return;
    setSending(true);
    const mime = blob.type || "audio/webm";
    const file = new File([blob], `voice_${Date.now()}.${extFromMime(mime)}`, { type: mime });
    try {
      await onSend(file, Math.round(duration));
      setBlob(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setDuration(0);
    } finally {
      setSending(false);
    }
  }, [blob, duration, onSend, preview]);

  // Botão inicial — não está gravando nem tem preview
  if (!recording && !preview) {
    return (
      <>
        <Button
          type="button"
          size="icon"
          onClick={start}
          aria-label="Gravar áudio"
          title="Gravar áudio"
          className="rounded-full"
        >
          <Mic className="h-4 w-4" />
        </Button>
        {error && <p className="text-xs text-destructive ml-2">{error}</p>}
      </>
    );
  }

  // Gravando ativamente
  if (recording) {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        <span className="text-xs font-mono text-destructive">{fmtSec(duration)}</span>
        <span className="text-xs text-muted-foreground">Gravando…</span>
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={cancel} aria-label="Descartar">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" onClick={stop} aria-label="Parar">
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Preview pronto
  return (
    <div className="flex flex-1 items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => {
          const el = audioElRef.current;
          if (!el) return;
          if (playing) el.pause();
          else el.play();
        }}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <audio
        ref={audioElRef}
        src={preview ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <div className={cn("h-1 flex-1 rounded bg-primary/20", playing && "animate-pulse")}>
        <div className="h-full w-full rounded bg-primary/50" />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{fmtSec(duration)}</span>
      <Button type="button" variant="ghost" size="icon" onClick={cancel} aria-label="Descartar">
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" onClick={send} disabled={sending} aria-label="Enviar">
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
