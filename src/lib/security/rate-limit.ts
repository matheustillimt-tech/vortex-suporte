/**
 * Rate limiter "best effort" in-memory.
 *
 * Cada função serverless da Vercel pode rodar em containers separados,
 * então isso NÃO é defesa robusta contra um atacante distribuído.
 * Mas é muito melhor do que nada e segura ataques single-source.
 *
 * Para upgrade real: ligar Upstash Redis (env UPSTASH_REDIS_REST_URL/TOKEN)
 * e trocar essa implementação por @upstash/ratelimit.
 *
 * Uso:
 *   const limited = rateLimit({ key: `identify:${ip}`, max: 30, windowSec: 60 });
 *   if (limited) return Response.json({ error: "rate_limited" }, { status: 429 });
 */

type Bucket = { count: number; reset: number };

const store = new Map<string, Bucket>();

// Limpeza periódica (uma vez por processo) — evita memory leak.
let pruner: ReturnType<typeof setInterval> | null = null;
function ensurePruner() {
  if (pruner) return;
  pruner = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of store) {
      if (b.reset <= now) store.delete(k);
    }
  }, 60_000);
  // serverless: não bloqueia shutdown
  (pruner as unknown as { unref?: () => void }).unref?.();
}

export type RateLimitResult = {
  /** true se BLOQUEADO (excedeu o limite) */
  blocked: boolean;
  /** quantas requisições ainda restam na janela */
  remaining: number;
  /** unix ms quando a janela reseta */
  reset: number;
};

export function rateLimit(opts: {
  key: string;
  max: number;
  windowSec: number;
}): RateLimitResult {
  ensurePruner();
  const now = Date.now();
  const bucket = store.get(opts.key);

  if (!bucket || bucket.reset <= now) {
    const reset = now + opts.windowSec * 1000;
    store.set(opts.key, { count: 1, reset });
    return { blocked: false, remaining: opts.max - 1, reset };
  }

  bucket.count += 1;
  const remaining = Math.max(0, opts.max - bucket.count);
  return { blocked: bucket.count > opts.max, remaining, reset: bucket.reset };
}

/** Extrai melhor IP disponível pra rate limit. Headers da Vercel já são confiáveis. */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-vercel-forwarded-for") ||
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown"
  );
}

/** Cabeçalhos HTTP padrão de rate-limit pra response. */
export function rateLimitHeaders(r: RateLimitResult, max: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(max),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.reset / 1000)),
  };
}
