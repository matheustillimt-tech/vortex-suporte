import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email() });

// Limites APERTADOS pra impedir flood de e-mail (Resend custa, e enumera contas)
const RL_IP_MAX = 5;        // 5 tentativas por IP / 10 min
const RL_IP_WINDOW = 600;
const RL_EMAIL_MAX = 3;     // 3 tentativas pra mesmo e-mail / hora
const RL_EMAIL_WINDOW = 3600;

export async function POST(req: Request) {
  const ip = clientIp(req);

  // limite por IP primeiro
  const ipRl = rateLimit({ key: `forgot:ip:${ip}`, max: RL_IP_MAX, windowSec: RL_IP_WINDOW });
  if (ipRl.blocked) {
    return NextResponse.json(
      { ok: true }, // mesma resposta — não vaza que foi bloqueado
      { status: 200, headers: rateLimitHeaders(ipRl, RL_IP_MAX) },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const { email } = parsed.data;

  // limite por e-mail (anti-spam pra alguém que conhece um e-mail)
  const emailRl = rateLimit({
    key: `forgot:email:${email.toLowerCase()}`,
    max: RL_EMAIL_MAX,
    windowSec: RL_EMAIL_WINDOW,
  });
  // Mesmo se bloqueado, responde 200 (não vaza)
  if (emailRl.blocked) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const admin = createAdminClient();

  // Sempre 200 (não vaza se o email existe ou não).
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${appUrl}/reset-password` },
    });

    if (error || !data?.properties?.hashed_token) {
      console.warn(`[forgot-password] generateLink falhou para ${email}:`, error?.message);
      return NextResponse.json({ ok: true });
    }

    // Link próprio → a rota /auth/confirm troca o token por sessão (fluxo SSR).
    // Não usamos o action_link cru: com @supabase/ssr (PKCE) ele chega no
    // /reset-password sem sessão e a tela dá erro. Via verifyOtp no servidor,
    // a sessão é gravada nos cookies e a tela de nova senha funciona.
    const confirmLink = `${appUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/reset-password`;
    await sendPasswordResetEmail(email, confirmLink);
  } catch (e) {
    console.error("[forgot-password] erro:", e);
  }

  return NextResponse.json({ ok: true });
}
