import { createClient } from "@/lib/supabase/client"
import type { Obra } from "./types"
import { registrarLogSeguro } from "./logs"

interface ObraRow {
  id: string
  cliente_id: string
  nome: string
  tipo: string | null
  cidade: string | null
  uf: string | null
  endereco: string | null
  area: number | string
  pavimentos: number | null
  padrao: string | null
  fase: string | null
  urgencia: string | null
  repetitividade: string | null
  observacoes: string | null
  arquivada: boolean
}

function toObra(r: ObraRow): Obra {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    nome: r.nome,
    tipo: r.tipo ?? "",
    cidade: r.cidade ?? "",
    uf: r.uf ?? "",
    endereco: r.endereco ?? "",
    area: Number(r.area ?? 0),
    pavimentos: r.pavimentos,
    padrao: r.padrao ?? "",
    fase: r.fase ?? "",
    urgencia: r.urgencia ?? "",
    repetitividade: r.repetitividade ?? "",
    observacoes: r.observacoes ?? "",
    arquivada: r.arquivada,
  }
}

export interface ObraInput {
  clienteId: string
  nome: string
  tipo?: string
  cidade?: string
  uf?: string
  endereco?: string
  area?: number
  pavimentos?: number | null
  padrao?: string
  fase?: string
  urgencia?: string
  repetitividade?: string
  observacoes?: string
}

function camposObra(input: ObraInput) {
  return {
    cliente_id: input.clienteId,
    nome: input.nome,
    tipo: input.tipo ?? null,
    cidade: input.cidade ?? null,
    uf: input.uf ?? null,
    endereco: input.endereco ?? null,
    area: input.area ?? 0,
    pavimentos: input.pavimentos ?? null,
    padrao: input.padrao ?? null,
    fase: input.fase ?? null,
    urgencia: input.urgencia ?? null,
    repetitividade: input.repetitividade ?? null,
    observacoes: input.observacoes ?? null,
  }
}

const SELECT_OBRA =
  "id,cliente_id,nome,tipo,cidade,uf,endereco,area,pavimentos,padrao,fase,urgencia,repetitividade,observacoes,arquivada"

// Lista as obras de um cliente (ativas por padrão).
export async function listarObrasPorCliente(
  clienteId: string,
  incluirArquivadas = false,
): Promise<Obra[]> {
  const supabase = createClient()
  let query = supabase
    .from("obras")
    .select(SELECT_OBRA)
    .eq("cliente_id", clienteId)
    .order("nome")
  if (!incluirArquivadas) query = query.eq("arquivada", false)
  const { data, error } = await query
  if (error) throw error
  return (data as ObraRow[]).map(toObra)
}

export async function getObra(id: string): Promise<Obra | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from("obras").select(SELECT_OBRA).eq("id", id).maybeSingle()
  if (error) throw error
  return data ? toObra(data as ObraRow) : null
}

export async function criarObra(input: ObraInput): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.from("obras").insert(camposObra(input)).select("id").single()
  if (error) throw error
  await registrarLogSeguro("Cadastro de obra", {
    entidade: input.nome,
    entidadeId: data.id,
    detalhe: "Obra criada",
  })
  return data.id as string
}

export async function atualizarObra(id: string, input: ObraInput): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("obras").update(camposObra(input)).eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Edição de obra", {
    entidade: input.nome,
    entidadeId: id,
    detalhe: "Obra atualizada",
  })
}

export async function arquivarObra(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("obras").update({ arquivada: true }).eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Obra arquivada", { entidadeId: id })
}
