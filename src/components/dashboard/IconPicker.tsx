"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ACCENTS, getIcon, ICON_NAMES } from "@/lib/widget-meta";
import { cn } from "@/lib/utils";
import type { BlockAccent } from "@/lib/supabase/types";

type Props = {
  iconName: string;
  iconUrl: string | null;
  accent: BlockAccent;
  onChange: (next: { iconName: string; iconUrl: string | null }) => void;
};

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "support-attachments";

export function IconPicker({ iconName, iconUrl, accent, onChange }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"system" | "upload">(iconUrl ? "upload" : "system");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Selecione uma imagem (PNG / SVG / JPG / WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2MB.");
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `block-icons/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      return alert(error.message);
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange({ iconName, iconUrl: pub.publicUrl });
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <Label>Ícone</Label>

      {/* Tabs */}
      <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setTab("system")}
          className={cn(
            "rounded px-3 py-1.5 font-medium transition-colors",
            tab === "system" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Ícones do sistema
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={cn(
            "rounded px-3 py-1.5 font-medium transition-colors",
            tab === "upload" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Enviar imagem
        </button>
      </div>

      {tab === "system" ? (
        <SystemGrid
          selected={iconName}
          accent={accent}
          hasCustomUpload={!!iconUrl}
          onSelect={(name) => onChange({ iconName: name, iconUrl: null })}
        />
      ) : (
        <div className="rounded-md border border-dashed border-border/80 bg-background p-3">
          {iconUrl ? (
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconUrl} alt="ícone" className="h-12 w-12 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Imagem enviada</p>
                <p className="text-[11px] text-muted-foreground truncate">{iconUrl}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ iconName, iconUrl: null })}
                aria-label="Remover imagem"
              >
                <X className="h-4 w-4" /> Remover
              </Button>
            </div>
          ) : (
            <DropZone
              uploading={uploading}
              onFile={handleFile}
              onClick={() => fileInput.current?.click()}
            />
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/svg+xml,image/webp,image/jpeg,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {tab === "system"
          ? "O fundo colorido segue a paleta escolhida em \"Cor\"."
          : "PNG com fundo transparente funciona melhor. Máximo 2 MB."}
      </p>
    </div>
  );
}

function SystemGrid({
  selected, accent, hasCustomUpload, onSelect,
}: {
  selected: string;
  accent: BlockAccent;
  hasCustomUpload: boolean;
  onSelect: (name: string) => void;
}) {
  const ac = ACCENTS[accent];
  return (
    <div className="rounded-md border border-border/60 bg-background p-2">
      {hasCustomUpload && (
        <p className="mb-2 px-1 text-[11px] text-muted-foreground">
          Selecione abaixo para descartar a imagem enviada.
        </p>
      )}
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
        {ICON_NAMES.map((name) => {
          const Icon = getIcon(name);
          const isSelected = selected === name && !hasCustomUpload;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onSelect(name)}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                isSelected
                  ? cn("ring-2 ring-primary", ac.bg, ac.text)
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {isSelected && (
                <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DropZone({
  uploading, onFile, onClick,
}: {
  uploading: boolean;
  onFile: (f: File) => void;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-8 text-xs text-muted-foreground transition-colors",
        hover ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      {uploading ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Enviando…</span>
        </>
      ) : (
        <>
          <div className="rounded-full bg-muted p-2.5 text-muted-foreground">
            <ImagePlus className="h-4 w-4" />
          </div>
          <span><span className="font-semibold text-foreground">Clique para escolher</span> ou arraste a imagem</span>
          <span className="text-[10px]">PNG (recomendado), SVG, WEBP, JPG — até 2 MB</span>
        </>
      )}
    </button>
  );
}
