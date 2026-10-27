/**
 * Verificação HMAC do `userHash` no identify().
 *
 * Fluxo:
 *   1. O servidor do seu site/app tem WIDGET_VERIFY_SECRET (mesmo valor que aqui)
 *   2. Antes de renderizar a página autenticada, calcula:
 *        userHash = HMAC-SHA256( email , WIDGET_VERIFY_SECRET ).hex
 *   3. Passa pro front-end e o front injeta em VortexSuporte.identify({email, userHash})
 *   4. Aqui verificamos. Se WIDGET_REQUIRE_USER_HASH=true e não bater → reject.
 *
 * Isso impede que um atacante chame /api/identify diretamente fingindo ser
 * qualquer e-mail de cliente — sem ter o secret, não consegue forjar o hash.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function isUserHashRequired(): boolean {
  return process.env.WIDGET_REQUIRE_USER_HASH === "true";
}

export function isUserHashConfigured(): boolean {
  return !!process.env.WIDGET_VERIFY_SECRET;
}

export function computeUserHash(email: string): string | null {
  const secret = process.env.WIDGET_VERIFY_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Retorna:
 *  - "ok" se válido (ou se verificação não está configurada/exigida)
 *  - "missing" se exigido mas não fornecido
 *  - "invalid" se fornecido mas não bate
 */
export function verifyUserHash(email: string, providedHash: string | null | undefined): "ok" | "missing" | "invalid" {
  // Se hash NÃO foi fornecido:
  if (!providedHash) {
    if (isUserHashRequired() && isUserHashConfigured()) return "missing";
    return "ok"; // verificação opcional desligada
  }

  // Hash fornecido — sempre tenta verificar se o secret existir
  const expected = computeUserHash(email);
  if (!expected) {
    // Não temos como verificar — mas se foi exigido, recusa
    return isUserHashRequired() ? "missing" : "ok";
  }

  const a = Buffer.from(providedHash, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}
