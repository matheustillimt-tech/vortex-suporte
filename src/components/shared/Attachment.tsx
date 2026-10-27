"use client";

import { FileIcon, FileTextIcon, ImageIcon, FileSpreadsheetIcon, DownloadIcon } from "lucide-react";
import type { Attachment } from "@/lib/supabase/types";
import { formatBytes, isImageMime } from "@/lib/utils";

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileTextIcon;
  if (mime.includes("spreadsheet") || mime === "text/csv" || mime === "application/vnd.ms-excel")
    return FileSpreadsheetIcon;
  return FileIcon;
}

function isVideoMime(mime: string) {
  return mime.startsWith("video/");
}
function isAudioMime(mime: string) {
  return mime.startsWith("audio/");
}

export function AttachmentBubble({ att }: { att: Attachment }) {
  if (isImageMime(att.mime)) {
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.url}
          alt={att.name}
          className="max-h-72 rounded-lg border border-white/5 object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  if (isVideoMime(att.mime)) {
    return (
      <video
        src={att.url}
        controls
        preload="metadata"
        className="max-h-80 max-w-full rounded-lg border border-white/5 bg-black"
      />
    );
  }

  if (isAudioMime(att.mime)) {
    return (
      <audio src={att.url} controls preload="metadata" className="w-64 max-w-full" />
    );
  }

  const Icon = iconFor(att.mime);
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 hover:bg-black/30 max-w-xs"
    >
      <Icon className="h-8 w-8 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{att.name}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(att.size)}</div>
      </div>
      <DownloadIcon className="h-4 w-4 text-muted-foreground" />
    </a>
  );
}
