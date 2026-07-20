import "server-only"
import { createClient } from "@/lib/supabase/server"

// Dados mínimos do usuário autenticado, resolvidos no servidor a partir da sessão.
export interface UsuarioSessao {
  authUserId: string
  usuarioId: string
  nome: string
  email: string | null
  funcao: string
}

export type ResultadoGuard =
  | { ok: true; user: UsuarioSessao }
  | { ok: false; error: string }

// Garante que há uma sessão válida e devolve o usuário logado (com seu registro
// em `usuarios`, quando existir). Não lança: devolve um resultado para compor
// com o contrato { ok, error } das server actions.
export async function exigirSessao(): Promise<ResultadoGuard> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." }

  const { data } = await supabase
    .from("usuarios")
    .select("id,nome,email,funcao")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  return {
    ok: true,
    user: {
      authUserId: user.id,
      usuarioId: data?.id ?? user.id,
      nome: data?.nome ?? user.email?.split("@")[0] ?? "Usuário",
      email: data?.email ?? user.email ?? null,
      funcao: data?.funcao ?? "Editor",
    },
  }
}

// Garante sessão + papel de Administrador. Falha "para o lado seguro": sem linha
// em `usuarios` legível, funcao cai para "Editor" e o acesso é negado.
export async function exigirAdmin(): Promise<ResultadoGuard> {
  const r = await exigirSessao()
  if (!r.ok) return r
  if (r.user.funcao !== "Administrador") {
    return { ok: false, error: "Ação restrita a administradores." }
  }
  return r
}
