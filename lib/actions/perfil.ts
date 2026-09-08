"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { exigirSessao } from "./_auth"

const perfilSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  // Cargo profissional (assinatura das propostas). String vazia limpa o campo e
  // faz o documento voltar ao cargo padrão.
  cargo: z.string().trim().max(60).optional(),
})

export interface PerfilAtualizado {
  nome: string
  cargo: string | null
}

// Atualiza o perfil do PRÓPRIO usuário logado. Escreve com service-role, mas
// sempre filtrando por `auth_user_id` da sessão — nunca aceita um id vindo do
// cliente, para que esta ação não vire um caminho de edição de perfil alheio.
export async function atualizarMeuPerfil(
  input: { nome?: string; cargo?: string },
): Promise<{ ok: boolean; error?: string; perfil?: PerfilAtualizado }> {
  const guard = await exigirSessao()
  if (!guard.ok) return { ok: false, error: guard.error }

  const validacao = perfilSchema.safeParse(input)
  if (!validacao.success) {
    return { ok: false, error: "Informe um nome válido e um cargo de até 60 caracteres." }
  }
  const { nome, cargo } = validacao.data
  if (nome === undefined && cargo === undefined) return { ok: false, error: "Nada a atualizar." }
  if (nome !== undefined && !nome) return { ok: false, error: "Informe o seu nome." }

  const patch: Record<string, unknown> = {}
  if (nome !== undefined) patch.nome = nome
  if (cargo !== undefined) patch.cargo = cargo || null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("usuarios")
    .update(patch)
    .eq("auth_user_id", guard.user.authUserId)
    .select("nome,cargo")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Perfil não encontrado. Fale com um administrador." }

  await admin.from("logs_uso").insert({
    acao: "Perfil atualizado",
    entidade: "Equipe",
    detalhe: guard.user.email ?? guard.user.nome,
  })

  return { ok: true, perfil: { nome: data.nome as string, cargo: (data.cargo as string | null) ?? null } }
}

export interface Signatario {
  id: string
  nome: string
  cargo: string | null
}

// Membros ativos que podem ser escolhidos como signatários de uma proposta.
//
// Aberta a qualquer sessão (não só a administradores): quem redige a proposta
// costuma não ser quem assina — um assistente comercial precisa poder emitir um
// documento assinado pelo diretor. Expõe apenas nome e cargo, que já saem
// impressos no documento; nada de e-mail, permissão ou situação de acesso.
export async function listarSignatarios(): Promise<Signatario[]> {
  const guard = await exigirSessao()
  if (!guard.ok) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("usuarios")
    .select("id,nome,cargo")
    .eq("ativo", true)
    .order("nome")
  if (error) return []

  return (data ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    cargo: (r.cargo as string | null) ?? null,
  }))
}
