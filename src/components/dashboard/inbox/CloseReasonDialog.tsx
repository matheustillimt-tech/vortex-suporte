"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CloseReason } from "@/lib/supabase/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Recebe o motivo escolhido. label = snapshot textual; id = referência (null se "Outros"). */
  onConfirm: (payload: { id: string | null; label: string; note: string | null }) => Promise<void> | void;
};

const OTHER_KEY = "__other__";

export function CloseReasonDialog({ open, onClose, onConfirm }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [reasons, setReasons] = useState<CloseReason[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setNote("");
    setBusy(false);
    (async () => {
      const { data } = await supabase
        .from("close_reasons")
        .select("*")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      setReasons((data ?? []) as CloseReason[]);
    })();
  }, [open, supabase]);

  const isOther = selected === OTHER_KEY;
  const canSubmit = !!selected && (!isOther || note.trim().length > 0);

  async function handleConfirm() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isOther) {
        await onConfirm({ id: null, label: "Outros", note: note.trim() });
      } else {
        const r = reasons?.find((x) => x.id === selected);
        if (!r) return;
        await onConfirm({ id: r.id, label: r.label, note: null });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Motivo da finalização
          </DialogTitle>
          <DialogDescription>
            Marque o motivo principal pra alimentar as métricas. É rápido e ajuda
            muito no dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto scroll-thin border-y border-border/40 px-5 py-3">
          {reasons === null ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {reasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    selected === r.id
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/40 hover:bg-secondary/40",
                  )}
                >
                  <span>{r.label}</span>
                  {selected === r.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected(OTHER_KEY)}
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  isOther
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/40 hover:bg-secondary/40",
                )}
              >
                <span>Outros</span>
                {isOther && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>

              {isOther && (
                <div className="mt-2 space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Descreva o motivo (vai aparecer no dashboard)
                  </label>
                  <Input
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex.: Cliente pediu nota fiscal antiga"
                    maxLength={200}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!canSubmit || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Finalizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
