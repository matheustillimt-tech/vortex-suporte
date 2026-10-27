"use client";

import { useEffect, useState } from "react";

export type QueueSnapshot = {
  position: number;
  totalInProgress: number;
  totalWaiting: number;
  departmentName: string | null;
};

/**
 * Faz polling do endpoint /api/conversations?id=... pra atualizar posição.
 * Default 3s — rápido o suficiente pra UX "ver subir" sem flood.
 */
export function useQueuePosition(opts: {
  enabled: boolean;
  conversationId: string | null;
  sessionToken: string | null;
  intervalMs?: number;
}): QueueSnapshot | null {
  const { enabled, conversationId, sessionToken, intervalMs = 3000 } = opts;
  const [snap, setSnap] = useState<QueueSnapshot | null>(null);

  useEffect(() => {
    if (!enabled || !conversationId || !sessionToken) {
      setSnap(null);
      return;
    }
    let active = true;

    async function tick() {
      try {
        const res = await fetch(`/api/conversations?id=${conversationId}`, {
          headers: { authorization: `Bearer ${sessionToken}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { queue: QueueSnapshot | null };
        if (active && data.queue) setSnap(data.queue);
      } catch {
        // ignore — próximo tick tenta de novo
      }
    }
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [enabled, conversationId, sessionToken, intervalMs]);

  return snap;
}
