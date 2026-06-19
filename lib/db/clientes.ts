import { createClient } from "@/lib/supabase/client"
import type { Cliente } from "./types"
import { registrarLogSeguro } from "./logs"

interface ClienteMetricaRow {
  id: string
  razao_social: string
  contato: string | null
  email: string | null
  telefone: string | null
  origem_id: string | null
  perfil_id: string | null
  cidade: string | null
  uf: string | null
  propostas_enviadas: number
  propostas_aprovadas: number
  valor_aprovado: number | string
  ultima_proposta: string | null
}

async function mapasReferencia(supabase: ReturnType<typeof createClient>) {
  const [origens, perfis] = await Promise.all([
    supabase.from("origens_cliente").select("id,nome"),
    supabase.from("perfis_cliente").select("id,nome"),
  ])
  const origemMap = new Map((origens.data ?? []).map((o: any) => [o.id, o.nome]))
  const perfilMap = new Map((perfis.data ?? []).map((p: any) => [p.id, p.nome]))
  return { origemMap, perfilMap }
}

export async function listarClientesComMetricas(): Promise<Cliente[]> {
  const supabase = createClient()
  const [{ data, error }, { origemMap, perfilMap }] = await Promise.all([
    supabase.from("clientes_metricas").select("*").order("razao_social"),
    mapasReferencia(supabase),
  ])
  if (error) throw error
  return (data as ClienteMetricaRow[]).map((c) => ({
    id: c.id,
    razaoSocial: c.razao_social,
    contato: c.contato ?? "",
    email: c.email ?? "",
    telefone: c.telefone ?? "",
    origem: c.origem_id ? origemMap.get(c.origem_id) ?? "" : "",
    perfil: c.perfil_id ? perfilMap.get(c.perfil_id) ?? "" : "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    propostasEnviadas: Number(c.propostas_enviadas ?? 0),
    propostasAprovadas: Number(c.propostas_aprovadas ?? 0),
    valorAprovado: Number(c.valor_aprovado ?? 0),
    ultimaProposta: c.ultima_proposta ?? "",
  }))
}

// Resolve nome -> id nas tabelas de referência (cria se não existir).
async function resolverRefId(
  supabase: ReturnType<typeof createClient>,
  tabela: "origens_cliente" | "perfis_cliente",
  nome: string | undefined,
): Promise<string | null> {
  if (!nome) return null
  const { data } = await supabase.from(tabela).select("id").eq("nome", nome).maybeSingle()
  return data?.id ?? null
}

export interface ClienteInput {
  razaoSocial: string
  nomeFantasia?: string
  documento?: string
  contato?: string
  email?: string
  telefone?: string
  origem?: string
  perfil?: string
  cidade?: string
  uf?: string
  endereco?: string
  observacoes?: string
}

function camposCliente(input: ClienteInput, origemId: string | null, perfilId: string | null) {
  return {
    razao_social: input.razaoSocial,
    nome_fantasia: input.nomeFantasia ?? null,
    documento: input.documento ?? null,
    contato: input.contato ?? null,
    email: input.email ?? null,
    telefone: input.telefone ?? null,
    origem_id: origemId,
    perfil_id: perfilId,
    cidade: input.cidade ?? null,
    uf: input.uf ?? null,
    endereco: input.endereco ?? null,
    observacoes: input.observacoes ?? null,
  }
}

export async function criarCliente(input: ClienteInput): Promise<string> {
  const supabase = createClient()
  const [origemId, perfilId] = await Promise.all([
    resolverRefId(supabase, "origens_cliente", input.origem),
    resolverRefId(supabase, "perfis_cliente", input.perfil),
  ])
  const { data, error } = await supabase
    .from("clientes")
    .insert(camposCliente(input, origemId, perfilId))
    .select("id")
    .single()
  if (error) throw error
  await registrarLogSeguro("Cadastro de cliente", {
    entidade: input.razaoSocial,
    entidadeId: data.id,
    detalhe: `Cliente criado`,
  })
  return data.id as string
}

export async function atualizarCliente(id: string, input: ClienteInput): Promise<void> {
  const supabase = createClient()
  const [origemId, perfilId] = await Promise.all([
    resolverRefId(supabase, "origens_cliente", input.origem),
    resolverRefId(supabase, "perfis_cliente", input.perfil),
  ])
  const { error } = await supabase
    .from("clientes")
    .update(camposCliente(input, origemId, perfilId))
    .eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Edição de cliente", {
    entidade: input.razaoSocial,
    entidadeId: id,
    detalhe: `Cliente atualizado`,
  })
}

// Retorna os campos editáveis de um cliente (para prefill do formulário de edição).
export async function getCliente(id: string): Promise<(ClienteInput & { id: string }) | null> {
  const supabase = createClient()
  const [{ data }, { origemMap, perfilMap }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    mapasReferencia(supabase),
  ])
  if (!data) return null
  return {
    id: data.id,
    razaoSocial: data.razao_social ?? "",
    nomeFantasia: data.nome_fantasia ?? "",
    documento: data.documento ?? "",
    contato: data.contato ?? "",
    email: data.email ?? "",
    telefone: data.telefone ?? "",
    origem: data.origem_id ? origemMap.get(data.origem_id) ?? "" : "",
    perfil: data.perfil_id ? perfilMap.get(data.perfil_id) ?? "" : "",
    cidade: data.cidade ?? "",
    uf: data.uf ?? "",
    endereco: data.endereco ?? "",
    observacoes: data.observacoes ?? "",
  }
}

export async function arquivarCliente(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("clientes").update({ arquivado: true }).eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Cliente arquivado", { entidadeId: id })
}
