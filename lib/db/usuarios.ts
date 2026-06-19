import { createClient } from "@/lib/supabase/client"
import type { UsuarioAtual } from "./types"

// Usuário logado (auth) + seu registro em `usuarios`.
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("usuarios")
    .select("id,auth_user_id,nome,email,funcao")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (data) {
    return {
      id: data.id,
      authUserId: data.auth_user_id,
      nome: data.nome,
      email: data.email,
      funcao: data.funcao,
    }
  }
  // Fallback: sem linha em usuarios ainda (trigger cuida disso normalmente).
  return {
    id: user.id,
    authUserId: user.id,
    nome: (user.user_metadata?.nome as string) || user.email?.split("@")[0] || "Usuário",
    email: user.email ?? null,
    funcao: "Editor",
  }
}

export async function listarEquipe(): Promise<{ id: string; nome: string; funcao: string; ativo: boolean; email: string | null }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nome,funcao,ativo,email")
    .order("created_at")
  if (error) throw error
  return data ?? []
}

export async function sair(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}
