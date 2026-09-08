"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { corpoConvite, corpoRedefinicao, enviarLinkDeAcesso, traduzErroAuth } from "@/lib/auth/link-acesso"
import { exigirAdmin, exigirSessao } from "./_auth"

// Duração de ban "permanente" para bloquear acesso de um membro desativado.
// GoTrue aceita uma duração no formato Go (h). ~100 anos.
const BAN_PERMANENTE = "876000h"
const emailSchema = z.string().trim().email()
const cargoSchema = z.string().trim().max(60)
const conviteSchema = z.object({
  nome: z.string().trim().min(1),
  email: emailSchema,
  funcao: z.string().trim().min(1).optional(),
  cargo: cargoSchema.optional(),
})

export interface MembroEquipe {
  id: string
  authUserId: string | null
  nome: string
  email: string | null
  // Papel de permissão (Administrador/Editor).
  funcao: string
  // Cargo profissional impresso na assinatura das propostas.
  cargo: string | null
  ativo: boolean
  // Situação do convite: "aceito" quando o usuário já confirmou o e-mail/definiu
  // a senha; "pendente" enquanto o convite não foi aceito.
  situacaoConvite: "aceito" | "pendente"
  // Último acesso (ISO) — null quando o membro nunca entrou.
  ultimoAcesso: string | null
}

interface UsuarioRow {
  id: string
  auth_user_id: string | null
  nome: string
  email: string | null
  funcao: string
  cargo: string | null
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
    .select("id,auth_user_id,nome,email,funcao,cargo,ativo")
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
      cargo: r.cargo,
      ativo: r.ativo,
      situacaoConvite: info?.situacao ?? "pendente",
      ultimoAcesso: info?.ultimoAcesso ?? null,
    }
  })
}

// Convida um novo membro por e-mail. O link de convite cria o usuário no Auth
// (o trigger handle_new_auth_user cria a linha em `usuarios`) e é entregue pelo
// Resend; garantimos nome/função/cargo na sequência.
export async function convidarUsuarioEquipe(input: {
  nome: string
  email: string
  funcao?: string
  cargo?: string
}): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const validacao = conviteSchema.safeParse(input)
  if (!validacao.success) return { ok: false, error: "Informe nome, e-mail e função válidos." }
  const convite = validacao.data
  const admin = createAdminClient()

  const envio = await enviarLinkDeAcesso({
    email: convite.email,
    tipo: "invite",
    assunto: "Seu acesso à plataforma IEX",
    corpo: corpoConvite,
    dadosUsuario: { nome: convite.nome },
  })

  // O usuário pode ter sido criado mesmo com falha no envio: completa o perfil
  // antes de reportar o erro, para que "Reenviar convite" já ache o cadastro certo.
  if (envio.userId) {
    await admin
      .from("usuarios")
      .update({
        nome: convite.nome,
        funcao: convite.funcao ?? "Editor",
        cargo: convite.cargo || null,
      })
      .eq("auth_user_id", envio.userId)
  }
  if (!envio.ok) return { ok: false, error: envio.error }

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

  const envio = await enviarLinkDeAcesso({
    email: emailValidado,
    tipo: "invite",
    assunto: "Seu acesso à plataforma IEX",
    corpo: corpoConvite,
  })
  if (!envio.ok) return { ok: false, error: envio.error }

  await createAdminClient().from("logs_uso").insert({
    acao: "Reenvio de convite",
    entidade: "Equipe",
    detalhe: emailValidado,
  })
  return { ok: true }
}

// Dispara o e-mail de redefinição de senha para o membro. Vai pelo Resend com o
// link já no formato que /auth/callback valida — não depende do SMTP nem dos
// templates de e-mail do Supabase.
export async function redefinirSenhaUsuario(email: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const validacao = emailSchema.safeParse(email)
  if (!validacao.success) return { ok: false, error: "Informe um e-mail válido." }
  const emailValidado = validacao.data

  const envio = await enviarLinkDeAcesso({
    email: emailValidado,
    tipo: "recovery",
    assunto: "Redefinição de senha — plataforma IEX",
    corpo: corpoRedefinicao,
  })
  if (!envio.ok) return { ok: false, error: envio.error }

  await createAdminClient().from("logs_uso").insert({
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

// Cargo profissional do membro (aparece na assinatura das propostas que ele gerar).
// Não confundir com `funcao`, que é a permissão de acesso.
export async function definirCargoUsuario(
  usuarioId: string,
  cargo: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await exigirAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const validacao = cargoSchema.safeParse(cargo)
  if (!validacao.success) return { ok: false, error: "O cargo deve ter até 60 caracteres." }
  const admin = createAdminClient()
  const { error } = await admin
    .from("usuarios")
    .update({ cargo: validacao.data || null })
    .eq("id", usuarioId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
