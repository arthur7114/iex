import "server-only"

import { headers } from "next/headers"
import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"

// Tipos de link de acesso gerados pela aplicação. `invite` é o primeiro acesso;
// `recovery` é a redefinição de senha. Ambos caem em /definir-senha.
export type TipoLinkAcesso = "invite" | "recovery"

export interface ResultadoEnvio {
  ok: boolean
  error?: string
  // Id do usuário no Auth (o link de convite cria o usuário quando ele não existe).
  userId?: string
}

// Resolve a URL base da aplicação para os links de convite/redefinição.
export async function resolverOrigem(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, "")
  const h = await headers()
  const origin = h.get("origin")
  if (origin) return origin
  const host = h.get("host")
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
    return `${proto}://${host}`
  }
  return ""
}

// Gera o link de acesso pelo GoTrue e o entrega pelo Resend.
//
// Não depende do SMTP nem dos templates de e-mail do Supabase: montamos aqui a
// URL com `token_hash`/`type` no formato que /auth/callback sabe validar. Era
// justamente essa dependência que fazia a redefinição de senha não chegar —
// o template padrão devolve o token no fragmento (#), invisível no servidor.
export async function enviarLinkDeAcesso(params: {
  email: string
  tipo: TipoLinkAcesso
  assunto: string
  // Recebe a URL pronta e devolve o corpo do e-mail em texto puro.
  corpo: (url: string) => string
  // Metadados gravados no usuário do Auth (só faz sentido no convite).
  dadosUsuario?: Record<string, unknown>
}): Promise<ResultadoEnvio> {
  const { email, tipo, assunto, corpo, dadosUsuario } = params
  const admin = createAdminClient()
  const origem = await resolverOrigem()

  // GenerateLinkParams é uma união discriminada: só o convite aceita `data`.
  const redirectTo = origem ? `${origem}/auth/callback?next=/definir-senha` : undefined
  const { data, error } = await (tipo === "invite"
    ? admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { data: dadosUsuario, redirectTo },
      })
    : admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      }))
  if (error) return { ok: false, error: traduzErroAuth(error.message) }

  const userId = data.user?.id

  const tokenHash = data.properties?.hashed_token
  const tipoVerificacao = data.properties?.verification_type
  if (!origem || !tokenHash || !tipoVerificacao) {
    return { ok: false, userId, error: "Configure a URL pública para gerar o link de acesso." }
  }

  const urlAcesso = new URL("/auth/callback", origem)
  urlAcesso.searchParams.set("token_hash", tokenHash)
  urlAcesso.searchParams.set("type", tipoVerificacao)
  urlAcesso.searchParams.set("next", "/definir-senha")

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      userId,
      error: "O link foi gerado, mas não enviado: configure RESEND_API_KEY e o domínio de e-mail.",
    }
  }
  const resend = new Resend(apiKey)
  const { error: erroEnvio } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "IEX Propostas <propostas@iexprojetos.com>",
    to: [email],
    subject: assunto,
    text: corpo(urlAcesso.toString()),
  })
  if (erroEnvio) {
    return {
      ok: false,
      userId,
      error: (erroEnvio as { message?: string }).message || "Não foi possível entregar o e-mail.",
    }
  }
  return { ok: true, userId }
}

// Corpo do e-mail de primeiro acesso (convite e reenvio).
export function corpoConvite(url: string): string {
  return [
    "Olá,",
    "",
    "Use o link abaixo para acessar a plataforma IEX e definir sua senha:",
    url,
    "",
    "Se você não esperava este convite, ignore esta mensagem.",
  ].join("\n")
}

// Corpo do e-mail de redefinição de senha.
export function corpoRedefinicao(url: string): string {
  return [
    "Olá,",
    "",
    "Recebemos um pedido para redefinir a senha da sua conta na plataforma IEX.",
    "Use o link abaixo para cadastrar uma nova senha:",
    url,
    "",
    "Se não foi você, ignore esta mensagem — sua senha atual continua valendo.",
  ].join("\n")
}

// Mensagens de erro do Auth mais legíveis em pt-BR.
export function traduzErroAuth(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("already been registered") || m.includes("already registered")) {
    return "Já existe um usuário com este e-mail."
  }
  if (m.includes("email") && (m.includes("send") || m.includes("smtp") || m.includes("provider"))) {
    return "Não foi possível enviar o e-mail. Verifique se o Resend está configurado (RESEND_API_KEY e domínio verificado)."
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente."
  }
  return msg
}
