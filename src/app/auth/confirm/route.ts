import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Troca o token do e-mail (recuperação de senha / confirmação) por uma sessão.
// Esse é o fluxo correto pro @supabase/ssr (PKCE): o link gerado pelo admin
// aponta pra cá com ?token_hash=...&type=recovery; aqui validamos via verifyOtp,
// que grava os cookies de sessão, e mandamos a pessoa pra tela de nova senha.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") || "/reset-password";
  // só permite redirecionos internos (anti open-redirect)
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/reset-password";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    // token expirado/já usado → manda pro reset com a mensagem amigável
    return NextResponse.redirect(new URL(`/reset-password?error=${encodeURIComponent(error.message)}`, origin));
  }

  return NextResponse.redirect(new URL("/reset-password?error=link_invalido", origin));
}
