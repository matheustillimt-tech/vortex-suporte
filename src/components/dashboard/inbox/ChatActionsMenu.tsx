"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Loader2, MoreHorizontal, RotateCcw, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  busy: boolean;
  canTake: boolean;
  canTransfer: boolean;
  canClose: boolean;
  canReopen: boolean;
  onTake: () => void;
  onTransfer: () => void;
  onClose: () => void;
  onReopen: () => void;
};

export function ChatActionsMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const actions = [
    { visible: props.canTransfer, label: "Trocar atendente", Icon: UserPlus, run: props.onTransfer },
    { visible: props.canClose, label: "Finalizar", Icon: CheckCircle2, run: props.onClose },
    { visible: props.canTake, label: "Assumir atendimento", Icon: UserCheck, run: props.onTake },
    { visible: props.canReopen, label: "Reabrir atendimento", Icon: RotateCcw, run: props.onReopen },
  ].filter(action => action.visible);

  return (
    <div ref={root} className="relative" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={event => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }}>
      <Button ref={trigger} type="button" size="icon" variant="outline" className="h-9 w-9"
        aria-label="Ações do atendimento" aria-expanded={open} aria-controls={open ? id : undefined}
        disabled={props.busy || !actions.length} onClick={() => setOpen(value => !value)}>
        {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-5 w-5" />}
      </Button>
      {open && <div id={id} role="group" aria-label="Ações do atendimento"
        className="absolute right-0 top-full z-50 mt-2 w-52 max-w-[85vw] rounded-lg border bg-card p-1 shadow-xl">
        {actions.map(({ label, Icon, run }) => <button key={label} type="button"
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
          onClick={() => { setOpen(false); trigger.current?.focus(); run(); }}>
          <Icon className="h-4 w-4" />{label}
        </button>)}
      </div>}
    </div>
  );
}
