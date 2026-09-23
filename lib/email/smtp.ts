import "server-only"

import nodemailer, { type Transporter } from "nodemailer"

// Envio de e-mail pelo SMTP da caixa da IEX (Titan: smtp.titan.email, 465, SSL/TLS).
// Sem SMTP_USER/SMTP_PASS o envio não está configurado — quem chama decide se
// isso vira "simulado" (propostas) ou erro (links de acesso).

export interface MensagemEmail {
  para: string
  copias?: string[]
  assunto: string
  texto: string
  // Parte HTML do multipart (opcional). Imagens referenciadas por `cid:` vêm em `anexos`.
  html?: string
  // Endereço de resposta — quem enviou a proposta. O `from` continua sendo a caixa autenticada.
  replyTo?: string
  anexos?: { nome: string; base64: string; mime: string; cid?: string }[]
}

export function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

let transporte: Transporter | null = null

function obterTransporte(): Transporter {
  if (!transporte) {
    const porta = Number(process.env.SMTP_PORT || 465)
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.titan.email",
      port: porta,
      // 465 = SSL/TLS direto; 587 usa STARTTLS.
      secure: porta === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return transporte
}

// Envia a mensagem e devolve o Message-ID do servidor. Lança em caso de falha.
export async function enviarEmail(msg: MensagemEmail): Promise<string> {
  // O Titan rejeita remetente diferente da caixa autenticada; o padrão cai na própria caixa.
  const remetente = process.env.EMAIL_FROM || `IEX Propostas <${process.env.SMTP_USER}>`
  const info = await obterTransporte().sendMail({
    from: remetente,
    to: msg.para,
    cc: msg.copias?.length ? msg.copias : undefined,
    replyTo: msg.replyTo,
    subject: msg.assunto,
    text: msg.texto,
    html: msg.html,
    attachments: msg.anexos?.map((a) => ({
      filename: a.nome,
      content: Buffer.from(a.base64, "base64"),
      contentType: a.mime,
      // Com cid, o nodemailer anexa como inline (Content-Disposition: inline).
      cid: a.cid,
    })),
  })
  return info.messageId
}
