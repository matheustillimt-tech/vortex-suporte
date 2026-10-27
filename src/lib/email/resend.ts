import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

let cached: Resend | null = null;
function client(): Resend {
  if (!cached) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY ausente nas variáveis de ambiente");
    cached = new Resend(key);
  }
  return cached;
}

/** E-mail só funciona com a chave e o remetente configurados (veja o .env.example). */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
}

function fromAddress(): string {
  const email = process.env.RESEND_FROM_EMAIL;
  if (!email) throw new Error("RESEND_FROM_EMAIL ausente nas variáveis de ambiente");
  const name = process.env.RESEND_FROM_NAME || `${BRAND.name} Suporte`;
  return `${name} <${email}>`;
}

const BRAND_TITLE = `${BRAND.name} Suporte`;
const BRAND_COLOR = BRAND.color;
// Logo no e-mail precisa de endereço completo (https://...).
const LOGO_URL = /^https?:\/\//.test(BRAND.logoUrl)
  ? BRAND.logoUrl
  : (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") + BRAND.logoUrl;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function layout(content: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(BRAND_TITLE)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,0.04);overflow:hidden;">
          <tr>
            <td style="padding:32px 36px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    ${LOGO_URL.startsWith("http") ? `<img src="${escapeHtml(LOGO_URL)}" alt="${escapeHtml(BRAND.name)}" width="32" height="32" style="display:block;border-radius:6px;" />` : ""}
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:16px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">${escapeHtml(BRAND.name)} <span style="color:${BRAND_COLOR};">Suporte</span></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 32px;font-size:15px;line-height:1.55;color:#27272a;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px;border-top:1px solid #f4f4f5;font-size:12px;color:#71717a;text-align:center;">
              Você recebeu este e-mail porque o endereço está cadastrado no suporte de ${escapeHtml(BRAND.name)}.<br/>
              Se não foi você, pode ignorar com segurança.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr><td style="border-radius:8px;background:${BRAND_COLOR};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;">${label}</a>
    </td></tr>
  </table>`;
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const html = layout(`
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#18181b;">Redefinir sua senha</h1>
    <p>Recebemos um pedido para redefinir a senha da sua conta no painel de suporte.</p>
    <p>Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora.</p>
    ${button(resetLink, "Redefinir senha")}
    <p style="font-size:12px;color:#71717a;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
    <p style="word-break:break-all;font-size:12px;color:#52525b;background:#f4f4f5;padding:10px 12px;border-radius:6px;">${resetLink}</p>
  `);

  const text = `Redefinir sua senha — ${BRAND_TITLE}

Recebemos um pedido para redefinir a senha da sua conta.
Acesse o link abaixo para escolher uma nova senha (expira em 1 hora):

${resetLink}

Se não foi você, ignore este e-mail.`;

  return client().emails.send({
    from: fromAddress(),
    to,
    subject: `Redefina sua senha — ${BRAND_TITLE}`,
    html,
    text,
  });
}

// Encerramento do atendimento: o cliente recebe a conversa completa e o
// resultado. Montagem em encerramento.ts (testável sem enviar).
export async function sendConversationClosedEmail(to: string, email: { subject: string; html: string; text: string }) {
  return client().emails.send({
    from: fromAddress(),
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
