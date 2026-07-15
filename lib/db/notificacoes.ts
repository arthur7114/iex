import { createClient } from "@/lib/supabase/client"
import { getUsuarioAtual } from "./usuarios"

// Notificações reais (Frente C / Onda 2). Camada de LEITURA + escrita de estado
// (marcar como lida) e preferências. A produção de eventos "sem retorno" fica na
// server action lib/actions/notificacoes.ts (sincronizarNotificacoes).

export type TipoNotificacao = "sem_retorno" | "aprovada" | "perdida" | "resumo_semanal"

export interface Notificacao {
  id: string
  usuarioId: string | null
  tipo: TipoNotificacao
  titulo: string
  descricao: string | null
  propostaId: string | null
  href: string | null
  lida: boolean
  criadoEm: string
}

export interface PreferenciasNotificacao {
  semRetorno: boolean
  aprovada: boolean
  perdida: boolean
  resumoSemanal: boolean
}

export const PREFERENCIAS_PADRAO: PreferenciasNotificacao = {
  semRetorno: true,
  aprovada: true,
  perdida: true,
  resumoSemanal: false,
}

// Detecta o caso "tabela ainda não existe" (migração 0114 não aplicada), para a
// UI degradar em silêncio (lista vazia / preferências padrão) em vez de quebrar.
function tabelaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|could not find the table|schema cache/i.test(error.message ?? "")
  )
}

interface NotificacaoRow {
  id: string
  usuario_id: string | null
  tipo: string
  titulo: string
  descricao: string | null
  proposta_id: string | null
  href: string | null
  lida: boolean
  created_at: string
}

function toNotificacao(r: NotificacaoRow): Notificacao {
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    tipo: (r.tipo as TipoNotificacao) ?? "sem_retorno",
    titulo: r.titulo,
    descricao: r.descricao,
    propostaId: r.proposta_id,
    href: r.href,
    lida: r.lida,
    criadoEm: r.created_at,
  }
}

// Lista as notificações destinadas ao usuário atual (ou globais: usuario_id null),
// já filtradas pelas preferências ativas. Nunca lança: retorna [] em erro/tabela ausente.
export async function listarNotificacoes(limite = 30): Promise<Notificacao[]> {
  try {
    const supabase = createClient()
    const usuario = await getUsuarioAtual()
    const [{ data, error }, prefs] = await Promise.all([
      supabase
        .from("notificacoes")
        .select("id,usuario_id,tipo,titulo,descricao,proposta_id,href,lida,created_at")
        .order("created_at", { ascending: false })
        .limit(limite),
      getPreferencias(),
    ])
    if (error) {
      if (!tabelaAusente(error)) console.error("Falha ao listar notificações:", error)
      return []
    }
    const habilitado: Record<TipoNotificacao, boolean> = {
      sem_retorno: prefs.semRetorno,
      aprovada: prefs.aprovada,
      perdida: prefs.perdida,
      resumo_semanal: prefs.resumoSemanal,
    }
    return (data as NotificacaoRow[])
      .map(toNotificacao)
      .filter((n) => n.usuarioId === null || n.usuarioId === usuario?.id)
      .filter((n) => habilitado[n.tipo] ?? true)
  } catch (e) {
    console.error("Falha ao listar notificações:", e)
    return []
  }
}

export async function contarNaoLidas(): Promise<number> {
  const notificacoes = await listarNotificacoes(100)
  return notificacoes.filter((n) => !n.lida).length
}

export async function marcarComoLida(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id)
  if (error && !tabelaAusente(error)) throw error
}

export async function marcarTodasComoLidas(): Promise<void> {
  const supabase = createClient()
  const usuario = await getUsuarioAtual()
  // Marca as notificações do usuário e as globais (usuario_id null).
  const query = supabase.from("notificacoes").update({ lida: true }).eq("lida", false)
  const { error } = usuario
    ? await query.or(`usuario_id.eq.${usuario.id},usuario_id.is.null`)
    : await query.is("usuario_id", null)
  if (error && !tabelaAusente(error)) throw error
}

// Preferências do usuário atual. Retorna o padrão se não houver linha/tabela.
export async function getPreferencias(): Promise<PreferenciasNotificacao> {
  try {
    const supabase = createClient()
    const usuario = await getUsuarioAtual()
    if (!usuario) return PREFERENCIAS_PADRAO
    const { data, error } = await supabase
      .from("notificacao_preferencias")
      .select("sem_retorno,aprovada,perdida,resumo_semanal")
      .eq("usuario_id", usuario.id)
      .maybeSingle()
    if (error) {
      if (!tabelaAusente(error)) console.error("Falha ao ler preferências:", error)
      return PREFERENCIAS_PADRAO
    }
    if (!data) return PREFERENCIAS_PADRAO
    return {
      semRetorno: data.sem_retorno ?? true,
      aprovada: data.aprovada ?? true,
      perdida: data.perdida ?? true,
      resumoSemanal: data.resumo_semanal ?? false,
    }
  } catch (e) {
    console.error("Falha ao ler preferências:", e)
    return PREFERENCIAS_PADRAO
  }
}

export async function salvarPreferencias(prefs: PreferenciasNotificacao): Promise<void> {
  const supabase = createClient()
  const usuario = await getUsuarioAtual()
  if (!usuario) throw new Error("Usuário não autenticado.")
  const { error } = await supabase.from("notificacao_preferencias").upsert(
    {
      usuario_id: usuario.id,
      sem_retorno: prefs.semRetorno,
      aprovada: prefs.aprovada,
      perdida: prefs.perdida,
      resumo_semanal: prefs.resumoSemanal,
    },
    { onConflict: "usuario_id" },
  )
  if (error) throw error
}
