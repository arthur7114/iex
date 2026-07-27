"use server"

import { headers } from "next/headers"
import { Resend } from "resend"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { exigirAdmin, exigirSessao } from "./_auth"

// Duração de ban "permanente" para bloquear acesso de um membro desativado.
// GoTrue aceita uma duração no formato Go (h). ~100 anos.
const BAN_PERMANENTE = "876000h"
const emailSchema = z.string().trim().email()
const conviteSchema = z.object({
  nome: z.string().trim().min(1),
  email: emailSchema,
  funcao: z.string().trim().min(1).optional(),
})

export interface MembroEquipe {
  id: string
  authUserId: string | null
  nome: string
  email: string | null
  funcao: string
  ativo: boolean
  // Situação do convite: "aceito" quando o usuário já confirmou o e-mail/definiu
  // a senha; "pendente" enquanto o convite não foi aceito.
  situacaoConvite: "aceito" | "pendente"
  // Último acesso (ISO) — null quando o membro nunca entrou.
  ultimoAcesso: string | null
}

// Resolve a URL base da aplicação para os links de convite/redefinição.
async function resolverOrigem(): Promise<string> {
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

interface UsuarioRow {
  id: string
  auth_user_id: string | null
  nome: string
  email: string | null
  funcao: string
  ativo: boolean
}

// Lista a equipe com dados de auth (situação do convite e último acesso),
// disponíveis apenas via service-role. Server-only.
export async function listarEquipeDetalhada(): Promise<MembroEquipe[]> {
  const guard = await exigirSessao()
  if (!guard.ok) throw new Error(guard.error)
  const admin = createAdminClient()
  const { data: usuarios, error } = await admin
    .from("usuarios")
    .select("id,auth_user_id,nome,email,funcao,ativo")
    .order("created_at")
  if (error) throw new Error(error.message)
  const rows = (usuarios ?? []) as UsuarioRow[]

  // Mapa auth_user_id -> dados de auth (paginação simples; equipe pequena).
  const authInfo = new Map<string, { situacao: "aceito" | "pendente"; ultimoAcesso: string | null }>()
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data?.users ?? []) {
      const confirmado = Boolean(u.email_confirmed_at || u.confirmed_at || u.last_sign_in_at)
      authInfo.set(u.id, {
        situacao: confirmado ? "aceito" : "pendente",
        ultimoAcesso: u.last_sign_in_at ?? null,
      })
    }
  } catch {
    // Sem acesso ao auth admin: degrada para "pendente"/sem último acesso.
  }

  return rows.map((r) => {
    const info = r.auth_user_id ? authInfo.get(r.auth_user_id) : undefined
    return {
      id: r.id,
      authUserId: r.auth_user_id,
      nome: r.nome,
      email: r.email,
      funcao: r.funcao,
      ativo: r.ativo,
      situacaoConvite: info?.situacao ?? "pendente",
      ultimoAcesso: info?.ultimoAcesso ?? null,
    }
  })
}

// Convida um novo membro por e-mail (Supabase Auth). O trigger handle_new_auth_user
// cria a linha em `usuarios`; garantimos nome/função na sequência.
export async function convidarUsuarioEquipe(input: {
  nome: string
  email: string
  funcao?: string
}): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const validacao = conviteSchema.safeParse(input)
  if (!validacao.success) return { ok: false, error: "Informe nome, e-mail e função válidos." }
  const convite = validacao.data
  const admin = createAdminClient()
  const origem = await resolverOrigem()
  // O template "Invite user" do Supabase usa TokenHash/RedirectTo conforme o
  // contrato operacional documentado; o callback também aceita PKCE por código.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(convite.email, {
    data: { nome: convite.nome },
    redirectTo: origem ? `${origem}/auth/callback?next=/definir-senha` : undefined,
  })
  if (error) return { ok: false, error: traduzErroAuth(error.message) }

  if (data.user?.id) {
    await admin
      .from("usuarios")
      .update({ nome: convite.nome, funcao: convite.funcao ?? "Editor" })
      .eq("auth_user_id", data.user.id)
  }

  await admin.from("logs_uso").insert({
    acao: "Convite de usuário",
    entidade: "Equipe",
    detalhe: `${convite.nome} (${convite.email})`,
  })
  return { ok: true }
}

// Reenvia o convite para um membro que ainda não aceitou.
export async function reenviarConvite(email: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const validacao = emailSchema.safeParse(email)
  if (!validacao.success) return { ok: false, error: "Informe um e-mail válido." }
  const emailValidado = validacao.data
  const admin = createAdminClient()
  const origem = await resolverOrigem()
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: emailValidado,
    options: { redirectTo: origem ? `${origem}/auth/callback?next=/definir-senha` : undefined },
  })
  if (error) return { ok: false, error: traduzErroAuth(error.message) }
  const tokenHash = data.properties?.hashed_token
  const tipoVerificacao = data.properties?.verification_type
  if (!origem || !tokenHash || !tipoVerificacao) {
    return { ok: false, error: "Configure a URL pública para gerar o link de acesso." }
  }
  const urlAcesso = new URL("/auth/callback", origem)
  urlAcesso.searchParams.set("token_hash", tokenHash)
  urlAcesso.searchParams.set("type", tipoVerificacao)
  urlAcesso.searchParams.set("next", "/definir-senha")

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: "O convite foi gerado, mas não enviado: configure RESEND_API_KEY e o domínio de e-mail.",
    }
  }
  const resend = new Resend(apiKey)
  const { error: erroEnvio } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "IEX Propostas <propostas@iexprojetos.com>",
    to: [emailValidado],
    subject: "Seu acesso à plataforma IEX",
    text: [
      "Olá,",
      "",
      "Use o link abaixo para acessar a plataforma IEX e definir sua senha:",
      urlAcesso.toString(),
      "",
      "Se você não esperava este convite, ignore esta mensagem.",
    ].join("\n"),
  })
  if (erroEnvio) {
    return {
      ok: false,
      error: (erroEnvio as { message?: string }).message || "Não foi possível entregar o convite.",
    }
  }
  await admin.from("logs_uso").insert({
    acao: "Reenvio de convite",
    entidade: "Equipe",
    detalhe: emailValidado,
  })
  return { ok: true }
}

// Dispara o e-mail de redefinição de senha para o membro.
export async function redefinirSenhaUsuario(email: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const validacao = emailSchema.safeParse(email)
  if (!validacao.success) return { ok: false, error: "Informe um e-mail válido." }
  const emailValidado = validacao.data
  const admin = createAdminClient()
  const origem = await resolverOrigem()
  // O template "Reset password" deve enviar token_hash/type=recovery ao callback.
  const { error } = await admin.auth.resetPasswordForEmail(emailValidado, {
    redirectTo: origem ? `${origem}/auth/callback?next=/definir-senha` : undefined,
  })
  if (error) return { ok: false, error: traduzErroAuth(error.message) }
  await admin.from("logs_uso").insert({
    acao: "Redefinição de senha",
    entidade: "Equipe",
    detalhe: emailValidado,
  })
  return { ok: true }
}

// Ativa/desativa o acesso de um membro. A desativação bloqueia de fato o acesso:
// aplica ban no Auth (impede novo login/refresh) e marca ativo=false (aplicado
// também no middleware para encerrar sessões vigentes).
export async function definirAtivoUsuario(
  usuarioId: string,
  ativo: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const admin = createAdminClient()

  const { data: usuario, error: erroBusca } = await admin
    .from("usuarios")
    .select("auth_user_id,nome,email")
    .eq("id", usuarioId)
    .maybeSingle()
  if (erroBusca) return { ok: false, error: erroBusca.message }

  const { error } = await admin.from("usuarios").update({ ativo }).eq("id", usuarioId)
  if (error) return { ok: false, error: error.message }

  // Bloqueio/desbloqueio no Auth.
  const authUserId = (usuario as { auth_user_id: string | null } | null)?.auth_user_id
  if (authUserId) {
    const { error: erroBan } = await admin.auth.admin.updateUserById(authUserId, {
      ban_duration: ativo ? "none" : BAN_PERMANENTE,
    })
    if (erroBan) {
      // Reverte a flag para manter consistência entre tabela e Auth.
      await admin.from("usuarios").update({ ativo: !ativo }).eq("id", usuarioId)
      return { ok: false, error: traduzErroAuth(erroBan.message) }
    }
  }

  await admin.from("logs_uso").insert({
    acao: ativo ? "Ativação de acesso" : "Desativação de acesso",
    entidade: "Equipe",
    detalhe: (usuario as { email: string | null } | null)?.email ?? usuarioId,
  })
  return { ok: true }
}

export async function definirFuncaoUsuario(
  usuarioId: string,
  funcao: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const admin = createAdminClient()
  const { error } = await admin.from("usuarios").update({ funcao }).eq("id", usuarioId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Mensagens de erro do Auth mais legíveis em pt-BR (ex.: SMTP ausente).
function traduzErroAuth(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("already been registered") || m.includes("already registered")) {
    return "Já existe um usuário com este e-mail."
  }
  if (m.includes("email") && (m.includes("send") || m.includes("smtp") || m.includes("provider"))) {
    return "Não foi possível enviar o e-mail. Verifique se um provedor de e-mail (SMTP) está configurado no Supabase."
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente."
  }
  return msg
}
