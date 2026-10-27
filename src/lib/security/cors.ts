/**
 * CORS scoped por endpoint.
 *
 * Antes: todos os /api/* tinham Access-Control-Allow-Origin: *
 * Agora: cada endpoint declara o conjunto de origens permitidas.
 *  - Widget APIs (identify, messages, upload, conversations, widget/*):
 *    aceitam só origens em WIDGET_ALLOWED_ORIGINS
 *  - Admin / auth APIs: same-origin apenas (não setam header)
 */
import { NextResponse } from "next/server";

// Sem WIDGET_ALLOWED_ORIGINS, só o próprio endereço do suporte é aceito.
const FALLBACK = process.env.NEXT_PUBLIC_APP_URL ?? "";

function parseAllowed(): string[] {
  const raw = process.env.WIDGET_ALLOWED_ORIGINS || FALLBACK;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function widgetCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = parseAllowed();
  // Se origin não veio (server-to-server, curl, etc.) → não seta CORS, mas API ainda funciona
  if (!origin) return {};
  const isAllowed = allowed.includes(origin) || allowed.includes("*");
  if (!isAllowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function widgetCorsResponse(origin: string | null, status = 204): Response {
  return new NextResponse(null, {
    status,
    headers: widgetCorsHeaders(origin),
  });
}

/** Para usar em GET/POST: clona a Response adicionando headers CORS apropriados. */
export function withWidgetCors<T extends Response>(res: T, origin: string | null): T {
  const headers = widgetCorsHeaders(origin);
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}
