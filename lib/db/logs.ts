import { createClient } from "@/lib/supabase/client"
import type { LogEntry } from "./types"

interface LogUsoRow {
  id: string
  usuario_nome: string | null
  acao: string
  entidade: string | null
  detalhe: string | null
  origem: string | null
  data: string
  hora: string
}

// Lista a auditoria a partir da view v_logs_uso (com data/hora derivados).
export async function listarLogs(limite = 200): Promise<LogEntry[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("v_logs_uso")
    .select("id,usuario_nome,acao,entidade,detalhe,origem,data,hora")
    .order("criado_em", { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data as LogUsoRow[]).map((r) => ({
    id: r.id,
    data: r.data,
    hora: r.hora,
    usuario: r.usuario_nome ?? "—",
    acao: r.acao,
    entidade: r.entidade ?? "—",
    detalhe: r.detalhe ?? "",
    origem: r.origem ?? "—",
  }))
}

// Registra uma ação na auditoria (usa fn_log_uso: identifica o usuário via auth.uid()).
export async function registrarLog(
  acao: string,
  opts: { entidade?: string; entidadeId?: string; detalhe?: string; origem?: string } = {},
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("fn_log_uso", {
    p_acao: acao,
    p_entidade: opts.entidade ?? null,
    p_entidade_id: opts.entidadeId ?? null,
    p_detalhe: opts.detalhe ?? null,
    p_origem: opts.origem ?? null,
  })
  if (error) throw error
}

// Versão que nunca lança: uma falha de auditoria não deve quebrar a ação do usuário.
export async function registrarLogSeguro(
  acao: string,
  opts: { entidade?: string; entidadeId?: string; detalhe?: string; origem?: string } = {},
): Promise<void> {
  try {
    await registrarLog(acao, opts)
  } catch (e) {
    console.error("Falha ao registrar log:", e)
  }
}

// Usuários distintos presentes nos logs (para o filtro da tela).
export async function listarUsuariosLog(): Promise<string[]> {
  const logs = await listarLogs(500)
  return Array.from(new Set(logs.map((l) => l.usuario))).sort()
}
