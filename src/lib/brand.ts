/**
 * Marca do suporte — tudo que identifica a SUA empresa na tela, no widget e nos e-mails.
 *
 * Troque pelas variáveis de ambiente (veja o .env.example). Como começam com
 * NEXT_PUBLIC_, o valor entra no código na hora do build: mudou na Vercel,
 * publique de novo (Redeploy) pra valer.
 *
 * A cor do widget (botão flutuante e destaques dentro dele) também pode ser
 * trocada no painel, em Widget > Configurações > Cor da marca.
 */

const DEFAULT_COLOR = "#7c3aed";

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/** "#abc" ou "#aabbcc" → "#aabbcc" em minúsculas; qualquer outra coisa → null. */
export function normalizeHex(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

/** "#7c3aed" → "263 70% 58%" (formato que as variáveis de cor do Tailwind usam). */
export function hexToHslTriplet(hex: string): string {
  const h = normalizeHex(hex) ?? DEFAULT_COLOR;
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

export const BRAND = {
  /** Nome da sua empresa ou produto. Aparece no painel, no widget e nos e-mails. */
  name: clean(process.env.NEXT_PUBLIC_BRAND_NAME) || "Sua Empresa",
  /** Endereço da logo (arquivo em /public ou URL https completa). Quadrada fica melhor. */
  logoUrl: clean(process.env.NEXT_PUBLIC_BRAND_LOGO_URL) || "/logo.svg",
  /** Cor principal em hexadecimal (#rrggbb). */
  color: normalizeHex(process.env.NEXT_PUBLIC_BRAND_COLOR) ?? DEFAULT_COLOR,
  /** Seu site ou app (onde o widget está instalado). Usado no botão do e-mail de encerramento. */
  siteUrl: clean(process.env.NEXT_PUBLIC_BRAND_SITE_URL).replace(/\/$/, ""),
} as const;

/** Título curto usado no widget e nas abas: "Suporte Sua Empresa". */
export const SUPPORT_TITLE = `Suporte ${BRAND.name}`;
