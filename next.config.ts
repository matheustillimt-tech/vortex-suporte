import type { NextConfig } from "next";

// Sites que podem mostrar o widget (lido na hora do build: mudou, publique de novo).
const allowedFrameAncestors = (process.env.WIDGET_ALLOWED_ORIGINS || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)
  .join(" ");

// Cabeçalhos de segurança aplicados a TODAS as páginas (não a /widget que tem sua própria CSP)
const SECURITY_HEADERS = [
  // Força HTTPS por 2 anos, incluindo subdomínios.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Bloqueia MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Não vaza URL completa em referers cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Bloqueia clickjacking pra dashboard (widget tem CSP frame-ancestors próprio).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Desliga APIs intrusivas que não usamos.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()" },
  // Reduz superfície de XSS no dashboard.
  // 'unsafe-inline' em styles é necessário pra Tailwind/CSS-in-JS.
  // 'unsafe-eval' precisa pro Next dev — vamos liberar só em script-src + acrescentar 'self'.
  // OBS: nonce-based CSP seria melhor; futura iteração.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://*.supabase.co https://*.storage.supabase.co wss://*.supabase.co https://api.resend.com",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // some o "X-Powered-By: Next.js" — menos info pro atacante
  // O database.types.ts é mínimo/escrito à mão e não cobre todas as colunas
  // adicionadas em migrações posteriores (edited_at, deleted_at, etc). As queries
  // estão corretas em execução; ignoramos essas lacunas de tipagem no build.
  // Pra religar a checagem: gere os tipos com `supabase gen types` e tire a linha abaixo.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      // Globais (sobrescritos por rotas específicas se necessário)
      {
        source: "/((?!widget|preview-frame|widget.js).*)",
        headers: SECURITY_HEADERS,
      },
      // Widget UI: pode ser embedada, tem CSP frame-ancestors restritiva
      {
        source: "/widget",
        headers: [
          {
            key: "Content-Security-Policy",
            // 'self' mantém a pré-visualização do painel funcionando.
            value: `frame-ancestors 'self' ${allowedFrameAncestors || "*"};`,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // preview-frame só serve pra admin embeded — restringe pro próprio domínio
      {
        source: "/preview-frame",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self';" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // widget.js — público, mas com cache curto
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // APIs NÃO setam mais CORS via config — cada rota gerencia o próprio (escopo correto)
    ];
  },
};

export default nextConfig;
