"use server"

import { createAdminClient } from "@/lib/supabase/admin"

function senhaTemporaria(): string {
  // senha temporária legível (sem depender de Math.random em escopo proibido do app)
  const base = "IexBeta"
  const n = (Date.now() % 10000).toString().padStart(4, "0")
  return `${base}!${n}`
}

// Cria um login para um membro da equipe (Supabase Auth). O trigger
// handle_new_auth_user cria/atualiza a linha em `usuarios`. Retorna a senha temporária.
export async function criarUsuarioEquipe(input: {
  nome: string
  email: string
  funcao?: string
}): Promise<{ ok: boolean; senha?: string; error?: string }> {
  const admin = createAdminClient()
  const senha = senhaTemporaria()
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: input.nome },
  })
  if (error) return { ok: false, error: error.message }

  // Garante nome/função na linha de usuarios criada pelo trigger.
  await admin
    .from("usuarios")
    .update({ nome: input.nome, funcao: input.funcao ?? "Editor" })
    .eq("auth_user_id", data.user!.id)

  await admin.from("logs_uso").insert({
    acao: "Cadastro de usuário",
    entidade: "Equipe",
    detalhe: `${input.nome} (${input.email})`,
  })
  return { ok: true, senha }
}

export async function definirAtivoUsuario(usuarioId: string, ativo: boolean): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from("usuarios").update({ ativo }).eq("id", usuarioId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function definirFuncaoUsuario(usuarioId: string, funcao: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from("usuarios").update({ funcao }).eq("id", usuarioId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
