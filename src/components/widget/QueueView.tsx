"use client";

import { Clock, Sparkles, Users } from "lucide-react";
import type { QueueSnapshot } from "@/lib/realtime/useQueuePosition";

const ORDINAIS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
function ordinal(n: number): string {
  return ORDINAIS[n - 1] ?? `${n}º`;
}

export function QueueView({ queue }: { queue: QueueSnapshot | null }) {
  // Carregando...
  if (!queue) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Clock className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">Verificando sua posição na fila…</p>
      </div>
    );
  }

  const { position, totalWaiting, totalInProgress, departmentName } = queue;
  const isFirst = position === 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto scroll-thin">
      {/* topo: ícone + texto */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center">
        <div className={`rounded-full p-4 ${isFirst ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary"}`}>
          {isFirst ? <Sparkles className="h-9 w-9" /> : <Clock className="h-9 w-9" />}
        </div>

        {isFirst ? (
          <>
            <div>
              <div className="text-3xl font-bold tracking-tight">Você é o próximo! 🎉</div>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                Um atendente já vai te chamar. Mantenha esta janela aberta.
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-[88px] leading-none font-bold tracking-tight text-primary">
                {ordinal(position)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">na fila de atendimento</div>
            </div>

            <p className="text-sm max-w-xs">
              {position === 2
                ? "Você é o próximo da fila!"
                : `Faltam ${position - 1} pessoas à sua frente.`}
            </p>
          </>
        )}

        {departmentName && (
          <div className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
            Fila do setor <span className="font-semibold text-foreground">{departmentName}</span>
          </div>
        )}
      </div>

      {/* rodapé com stats discretos */}
      <div className="grid grid-cols-2 gap-2 border-t border-border/40 bg-card/40 p-3">
        <Stat label="Aguardando" value={String(totalWaiting)} />
        <Stat label="Em atendimento agora" value={String(totalInProgress)} icon={Users} />
      </div>

      <p className="px-6 pb-4 pt-3 text-center text-[11px] text-muted-foreground/80">
        Se você fechar e abrir o chat de novo, sua posição é recalculada.
      </p>
    </div>
  );
}

function Stat({
  label, value, icon: Icon,
}: { label: string; value: string; icon?: typeof Clock }) {
  return (
    <div className="rounded-lg bg-background/50 px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
