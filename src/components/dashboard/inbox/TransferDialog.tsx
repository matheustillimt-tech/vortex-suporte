"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/supabase/types";

type Props = {
  open: boolean;
  onClose: () => void;
  currentAgentId: string;
  /** Chamado quando o admin/agente confirma a transferência. */
  onTransfer: (newAgent: Pick<Agent, "id" | "name">) => Promise<void> | void;
};

export function TransferDialog({ open, onClose, currentAgentId, onTransfer }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [query, setQuery] = useState("");
  const [transferring, setTransferring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTransferring(null);
    (async () => {
      const { data } = await supabase
        .from("agents")
        .select("*")
        .order("name", { ascending: true });
      setAgents((data ?? []) as Agent[]);
    })();
  }, [open, supabase]);

  const filtered = (agents ?? [])
    .filter((a) => a.id !== currentAgentId)
    .filter((a) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    });

  async function handlePick(a: Agent) {
    setTransferring(a.id);
    try {
      await onTransfer({ id: a.id, name: a.name });
      onClose();
    } finally {
      setTransferring(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Transferir atendimento
          </DialogTitle>
          <DialogDescription>
            Escolha quem deve assumir esta conversa. O cliente será notificado.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="max-h-[55vh] min-h-[120px] overflow-auto scroll-thin border-t border-border/40">
          {agents === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Users className="h-5 w-5" />
              {query
                ? `Nenhum atendente combina com "${query}".`
                : "Não há outros atendentes cadastrados."}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((a) => {
                const busy = transferring === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void handlePick(a)}
                      disabled={transferring !== null}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
                        "hover:bg-secondary/50 disabled:opacity-60",
                      )}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                          {getInitials(a.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{a.name}</span>
                          {a.role === "admin" && (
                            <Badge variant="muted" className="text-[10px]">Admin</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                      </div>
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Button size="sm" variant="ghost" className="pointer-events-none">
                          Transferir
                        </Button>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
