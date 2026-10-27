// E-mail de ENCERRAMENTO do atendimento — o cliente recebe o histórico da
// conversa quando o atendente finaliza. Serve
// sobretudo pra quem parou de responder no meio: prova que foi atendido e o
// que ficou combinado fica guardado na caixa de entrada dele.
//
// Só monta assunto/HTML/texto. Quem envia é sendConversationClosedEmail
// (resend.ts); separado assim pra dar pra testar a montagem sem mandar nada.
import { layout, button } from "./resend";
import { BRAND } from "@/lib/brand";

export type MensagemDoResumo = {
  autor: "contact" | "agent" | "bot" | "system";
  nome: string | null;
  texto: string | null;
  anexos: { name: string; url: string }[];
  em: string; // ISO
};

export type DadosDoEncerramento = {
  nomeDoCliente: string | null;
  nomeDoAtendente: string | null;
  motivo: string | null; // close_reason_label
  observacao: string | null; // close_reason_note
  encerradoEm: string; // ISO
  mensagens: MensagemDoResumo[];
  /** Pra onde o botão "Falar com o suporte" leva (seu site/app). Vazio = sem botão. */
  linkDoChat: string;
  /** Nome da empresa que aparece no e-mail. */
  marca?: string;
};

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function horaBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function dataBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Mensagens que entram no e-mail: o que o cliente e a equipe disseram.
 *  As de sistema ("fulano assumiu", "atendimento concluído") são ruído aqui. */
export function mensagensDoResumo(msgs: MensagemDoResumo[]): MensagemDoResumo[] {
  return msgs.filter((m) => m.autor !== "system" && ((m.texto ?? "").trim() || m.anexos.length));
}

export function montarEmailEncerramento(d: DadosDoEncerramento): { subject: string; html: string; text: string } {
  const marca = d.marca || BRAND.name;
  const suporte = `Suporte ${marca}`;
  const primeiroNome = (d.nomeDoCliente ?? "").trim().split(/\s+/)[0] || null;
  const msgs = mensagensDoResumo(d.mensagens);
  const motivoLinha = d.motivo ? `${d.motivo}${d.observacao ? ` — ${d.observacao}` : ""}` : null;

  const linhasHtml = msgs.map((m) => {
    const doCliente = m.autor === "contact";
    const quem = doCliente ? (m.nome || "Você") : (m.nome || (m.autor === "bot" ? marca : suporte));
    const anexos = m.anexos.map((a) => `<div style="font-size:12px;margin-top:4px;">📎 <a href="${escapar(a.url)}" style="color:#0f766e;">${escapar(a.name)}</a></div>`).join("");
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;vertical-align:top;">
      <div style="font-size:12px;color:#71717a;margin-bottom:3px;"><strong style="color:${doCliente ? "#18181b" : "#0f766e"};">${escapar(quem)}</strong> · ${horaBR(m.em)}</div>
      <div style="white-space:pre-wrap;word-break:break-word;">${escapar(m.texto ?? "")}</div>${anexos}
    </td></tr>`;
  }).join("");

  const html = layout(`
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#18181b;">Seu atendimento foi concluído</h1>
    <p>${primeiroNome ? `Olá, ${escapar(primeiroNome)}! ` : "Olá! "}Encerramos o seu atendimento${d.nomeDoAtendente ? ` com ${escapar(d.nomeDoAtendente)}` : ""} em ${dataBR(d.encerradoEm)}.</p>
    ${motivoLinha ? `<p style="margin:12px 0;padding:10px 14px;background:#f4f4f5;border-left:3px solid ${BRAND.color};border-radius:6px;"><strong>Resultado:</strong> ${escapar(motivoLinha)}</p>` : ""}
    <p>Abaixo está a conversa completa, pra você guardar o que ficou combinado.</p>
    ${msgs.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;font-size:14px;line-height:1.5;">${linhasHtml}</table>`
      : `<p style="color:#71717a;">Não houve troca de mensagens nesta conversa.</p>`}
    <p>Ficou alguma dúvida ou o problema voltou? É só abrir o chat de novo.</p>
    ${d.linkDoChat ? button(escapar(d.linkDoChat), "Falar com o suporte") : ""}
    ${d.linkDoChat ? `<p style="font-size:12px;color:#71717a;">O chat fica no balão de suporte do nosso site: ${escapar(d.linkDoChat)}</p>` : ""}
  `);

  const linhasTexto = msgs.map((m) => {
    const quem = m.autor === "contact" ? (m.nome || "Você") : (m.nome || (m.autor === "bot" ? marca : suporte));
    const anexos = m.anexos.map((a) => `\n  [anexo] ${a.name}: ${a.url}`).join("");
    return `[${horaBR(m.em)}] ${quem}: ${(m.texto ?? "").trim()}${anexos}`;
  }).join("\n\n");

  const text = `Seu atendimento foi concluído — ${suporte}

${primeiroNome ? `Olá, ${primeiroNome}! ` : "Olá! "}Encerramos o seu atendimento${d.nomeDoAtendente ? ` com ${d.nomeDoAtendente}` : ""} em ${dataBR(d.encerradoEm)}.
${motivoLinha ? `\nResultado: ${motivoLinha}\n` : ""}
Abaixo está a conversa completa, pra você guardar o que ficou combinado.

${linhasTexto || "(Não houve troca de mensagens nesta conversa.)"}

Ficou alguma dúvida ou o problema voltou? É só abrir o chat de novo${d.linkDoChat ? `: ${d.linkDoChat}` : "."}`;

  return { subject: `Seu atendimento foi concluído — ${suporte}`, html, text };
}
