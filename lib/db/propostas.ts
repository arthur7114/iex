import { createClient } from "@/lib/supabase/client"
import type { Proposta, ItemProposta, StatusProposta } from "./types"
import { registrarLog } from "./logs"

const SELECT_FULL =
  "*, proposta_itens(*), proposta_eventos(*), motivos_perda(nome)"

interface ItemRow {
  id: string
  disciplina_id: string | null
  disciplina_nome: string
  valor_sugerido: number | string
  valor_final: number | string
  justificativa: string | null
  ordem: number
}
interface EventoRow {
  data: string
  usuario_nome: string | null
  acao: string
}
interface PropostaRow {
  id: string
  numero: string
  cliente_id: string | null
  cliente_nome: string | null
  obra_id: string | null
  empreendimento: string | null
  tipo: string | null
  cidade: string | null
  uf: string | null
  area: number | string
  disciplinas: string[]
  valor_sugerido: number | string
  valor_final: number | string
  status: StatusProposta
  responsavel_nome: string | null
  origem: string | null
  motivo_perda_id: string | null
  proximos_passos: string | null
  data_criacao: string
  data_envio: string | null
  updated_at: string
  proposta_itens: ItemRow[]
  proposta_eventos: EventoRow[]
  motivos_perda: { nome: string } | null
}

function diasSemRetorno(status: string, dataEnvio: string | null): number {
  if (status !== "Enviada" || !dataEnvio) return 0
  const ms = Date.now() - new Date(dataEnvio + "T00:00:00").getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

function toProposta(r: PropostaRow): Proposta {
  const itens: ItemProposta[] = (r.proposta_itens ?? [])
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => ({
      disciplinaId: i.disciplina_id ?? "",
      disciplina: i.disciplina_nome,
      valorSugerido: Number(i.valor_sugerido),
      valorFinal: Number(i.valor_final),
      justificativa: i.justificativa ?? undefined,
    }))
  const historico = (r.proposta_eventos ?? [])
    .slice()
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((e) => ({ data: e.data, usuario: e.usuario_nome ?? "—", acao: e.acao }))
  return {
    id: r.id,
    numero: r.numero,
    cliente: r.cliente_nome ?? "",
    clienteId: r.cliente_id ?? "",
    obraId: r.obra_id ?? undefined,
    empreendimento: r.empreendimento ?? "",
    tipo: r.tipo ?? "",
    cidade: r.cidade ?? "",
    uf: r.uf ?? "",
    area: Number(r.area),
    disciplinas: r.disciplinas ?? [],
    itens,
    valorSugerido: Number(r.valor_sugerido),
    valorFinal: Number(r.valor_final),
    status: r.status,
    responsavel: r.responsavel_nome ?? "",
    origem: r.origem ?? "",
    dataCriacao: r.data_criacao,
    dataEnvio: r.data_envio,
    ultimaAtualizacao: r.updated_at?.slice(0, 10) ?? r.data_criacao,
    diasSemRetorno: diasSemRetorno(r.status, r.data_envio),
    motivoPerda: (r.motivos_perda?.nome as Proposta["motivoPerda"]) ?? undefined,
    proximosPassos: r.proximos_passos ?? "",
    historico,
  }
}

export async function listarPropostas(): Promise<Proposta[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("propostas")
    .select(SELECT_FULL)
    .eq("arquivada", false)
    .order("data_criacao", { ascending: false })
  if (error) throw error
  return (data as unknown as PropostaRow[]).map(toProposta)
}

export async function getProposta(id: string): Promise<Proposta | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from("propostas").select(SELECT_FULL).eq("id", id).maybeSingle()
  if (error) throw error
  return data ? toProposta(data as unknown as PropostaRow) : null
}

// Retorna os campos crus de uma proposta para reabrir no wizard (edição).
export interface PropostaEdicao {
  clienteId: string | null
  obraId: string | null
  clienteNome: string
  empreendimento: string
  tipo: string
  cidade: string
  uf: string
  area: number
  pavimentos: number
  padrao: string
  fase: string
  complexidade: Record<string, string> | null
  origem: string
  formaPagamento: string
  prazoExecucao: string
  validade: string
  premissas: string
  exclusoes: string
  observacoes: string
  responsavelId: string | null
  responsavelNome: string
  parcelas: ParcelaProposta[] | null
  itens: { disciplinaId: string; disciplina: string; valorSugerido: number; valorFinal: number; justificativa: string; escopo: string[] }[]
}

export async function getPropostaEdicao(id: string): Promise<PropostaEdicao | null> {
  const supabase = createClient()
  const { data: p } = await supabase.from("propostas").select("*, proposta_itens(*)").eq("id", id).maybeSingle()
  if (!p) return null
  return {
    clienteId: p.cliente_id ?? null,
    obraId: p.obra_id ?? null,
    clienteNome: p.cliente_nome ?? "",
    empreendimento: p.empreendimento ?? "",
    tipo: p.tipo ?? "",
    cidade: p.cidade ?? "",
    uf: p.uf ?? "",
    area: Number(p.area),
    pavimentos: p.pavimentos ?? 0,
    padrao: p.padrao ?? "Médio",
    fase: p.fase ?? "Executivo",
    complexidade: (p.complexidade as Record<string, string>) ?? null,
    origem: p.origem ?? "",
    formaPagamento: p.forma_pagamento ?? "40/40/20",
    prazoExecucao: p.prazo_execucao ?? "30 dias úteis",
    validade: p.validade ?? "20 dias corridos",
    premissas: p.premissas ?? "",
    exclusoes: p.exclusoes ?? "",
    observacoes: p.observacoes ?? "",
    responsavelId: p.responsavel_id ?? null,
    responsavelNome: p.responsavel_nome ?? "",
    parcelas: (p.parcelas as ParcelaProposta[]) ?? null,
    itens: (p.proposta_itens ?? [])
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((i: any) => ({
        disciplinaId: i.disciplina_id ?? "",
        disciplina: i.disciplina_nome,
        valorSugerido: Number(i.valor_sugerido),
        valorFinal: Number(i.valor_final),
        justificativa: i.justificativa ?? "",
        escopo: (i.escopo as string[]) ?? [],
      })),
  }
}

// Gera o próximo número no padrão PRP-AAAA-NNNN.
export async function proximoNumero(): Promise<string> {
  const supabase = createClient()
  const ano = new Date().getFullYear()
  const prefixo = `PRP-${ano}-`
  const { data } = await supabase
    .from("propostas")
    .select("numero")
    .like("numero", `${prefixo}%`)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle()
  let seq = 1
  if (data?.numero) {
    const n = parseInt(String(data.numero).replace(prefixo, ""), 10)
    if (!Number.isNaN(n)) seq = n + 1
  }
  return `${prefixo}${String(seq).padStart(4, "0")}`
}

// Parcela/marco estruturado da forma de pagamento (PRD 14.4).
export interface ParcelaProposta {
  descricao: string
  percentual: number
  valor: number
  marco?: boolean
}

export interface NovaPropostaInput {
  clienteId?: string | null
  obraId?: string | null
  clienteNome: string
  empreendimento: string
  tipo: string
  cidade: string
  uf: string
  area: number
  pavimentos?: number
  padrao?: string
  fase?: string
  disciplinas: string[]
  complexidade?: Record<string, string> | null
  itens: { disciplinaId: string; disciplina: string; valorSugerido: number; valorFinal: number; justificativa?: string; escopo?: string[] }[]
  valorSugerido: number
  valorFinal: number
  origem?: string
  formaPagamento?: string
  parcelas?: ParcelaProposta[] | null
  prazoExecucao?: string
  validade?: string
  premissas?: string
  exclusoes?: string
  observacoes?: string
  responsavelId?: string | null
  responsavelNome?: string
}

export async function criarProposta(input: NovaPropostaInput): Promise<{ id: string; numero: string }> {
  const supabase = createClient()
  const numero = await proximoNumero()
  const { data: prop, error } = await supabase
    .from("propostas")
    .insert({
      numero,
      cliente_id: input.clienteId ?? null,
      obra_id: input.obraId ?? null,
      cliente_nome: input.clienteNome,
      empreendimento: input.empreendimento,
      tipo: input.tipo,
      cidade: input.cidade,
      uf: input.uf,
      area: input.area,
      pavimentos: input.pavimentos ?? null,
      padrao: input.padrao ?? null,
      fase: input.fase ?? null,
      disciplinas: input.disciplinas,
      complexidade: input.complexidade ?? null,
      valor_sugerido: input.valorSugerido,
      valor_final: input.valorFinal,
      status: "Em elaboração",
      responsavel_id: input.responsavelId ?? null,
      responsavel_nome: input.responsavelNome ?? null,
      origem: input.origem ?? null,
      forma_pagamento: input.formaPagamento ?? null,
      parcelas: input.parcelas ?? null,
      prazo_execucao: input.prazoExecucao ?? null,
      validade: input.validade ?? null,
      premissas: input.premissas ?? null,
      exclusoes: input.exclusoes ?? null,
      observacoes: input.observacoes ?? null,
      proximos_passos: "Proposta gerada. Aguardando envio.",
      wizard_step: 8,
    })
    .select("id,numero")
    .single()
  if (error) throw error
  const propostaId = prop.id as string

  if (input.itens.length) {
    const itensRows = input.itens.map((it, i) => ({
      proposta_id: propostaId,
      disciplina_id: it.disciplinaId || null,
      disciplina_nome: it.disciplina,
      valor_sugerido: it.valorSugerido,
      valor_final: it.valorFinal,
      justificativa: it.justificativa || null,
      escopo: it.escopo ?? [],
      ordem: i,
    }))
    const { error: itErr } = await supabase.from("proposta_itens").insert(itensRows)
    if (itErr) throw itErr
  }

  await supabase.from("proposta_eventos").insert({
    proposta_id: propostaId,
    usuario_id: input.responsavelId ?? null,
    usuario_nome: input.responsavelNome ?? null,
    acao: "Proposta criada",
  })

  await registrarLog("Criação de proposta", {
    entidade: numero,
    entidadeId: propostaId,
    detalhe: `${input.clienteNome} — ${input.empreendimento}`,
  })

  return { id: propostaId, numero }
}

// Atualiza uma proposta existente (edição/reabertura via wizard) + substitui itens.
export async function atualizarProposta(id: string, input: NovaPropostaInput): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("propostas")
    .update({
      cliente_id: input.clienteId ?? null,
      obra_id: input.obraId ?? null,
      cliente_nome: input.clienteNome,
      empreendimento: input.empreendimento,
      tipo: input.tipo,
      cidade: input.cidade,
      uf: input.uf,
      area: input.area,
      pavimentos: input.pavimentos ?? null,
      padrao: input.padrao ?? null,
      fase: input.fase ?? null,
      disciplinas: input.disciplinas,
      complexidade: input.complexidade ?? null,
      valor_sugerido: input.valorSugerido,
      valor_final: input.valorFinal,
      origem: input.origem ?? null,
      forma_pagamento: input.formaPagamento ?? null,
      parcelas: input.parcelas ?? null,
      prazo_execucao: input.prazoExecucao ?? null,
      validade: input.validade ?? null,
      premissas: input.premissas ?? null,
      exclusoes: input.exclusoes ?? null,
      observacoes: input.observacoes ?? null,
    })
    .eq("id", id)
  if (error) throw error

  await supabase.from("proposta_itens").delete().eq("proposta_id", id)
  if (input.itens.length) {
    await supabase.from("proposta_itens").insert(
      input.itens.map((it, i) => ({
        proposta_id: id,
        disciplina_id: it.disciplinaId || null,
        disciplina_nome: it.disciplina,
        valor_sugerido: it.valorSugerido,
        valor_final: it.valorFinal,
        justificativa: it.justificativa || null,
        escopo: it.escopo ?? [],
        ordem: i,
      })),
    )
  }
  await supabase.from("proposta_eventos").insert({
    proposta_id: id,
    usuario_id: input.responsavelId ?? null,
    usuario_nome: input.responsavelNome ?? null,
    acao: "Proposta editada",
  })
  await registrarLog("Edição de proposta", { entidade: input.clienteNome, entidadeId: id, detalhe: input.empreendimento })
}

// Transição de status com validação + auditoria (RPC do banco).
export async function transicionarStatus(
  propostaId: string,
  novoStatus: StatusProposta,
  motivoId?: string | null,
  detalhe?: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("fn_transicionar_status", {
    p_proposta_id: propostaId,
    p_novo_status: novoStatus,
    p_motivo_id: motivoId ?? null,
    p_detalhe: detalhe ?? null,
  })
  if (error) throw error
}

// Duplica uma proposta (volta para "Em elaboração", novo número).
export async function duplicarProposta(id: string): Promise<{ id: string; numero: string }> {
  // Usa getPropostaEdicao (campos crus completos) para não perder escopo, parcelas,
  // complexidade nem condições comerciais na cópia.
  const p = await getPropostaEdicao(id)
  if (!p) throw new Error("Proposta não encontrada")
  const valorSugerido = p.itens.reduce((a, i) => a + i.valorSugerido, 0)
  const valorFinal = p.itens.reduce((a, i) => a + i.valorFinal, 0)
  return criarProposta({
    clienteId: p.clienteId,
    obraId: p.obraId,
    clienteNome: p.clienteNome,
    empreendimento: p.empreendimento + " (cópia)",
    tipo: p.tipo,
    cidade: p.cidade,
    uf: p.uf,
    area: p.area,
    pavimentos: p.pavimentos,
    padrao: p.padrao,
    fase: p.fase,
    disciplinas: p.itens.map((i) => i.disciplina),
    complexidade: p.complexidade,
    itens: p.itens.map((i) => ({
      disciplinaId: i.disciplinaId,
      disciplina: i.disciplina,
      valorSugerido: i.valorSugerido,
      valorFinal: i.valorFinal,
      justificativa: i.justificativa,
      escopo: i.escopo,
    })),
    valorSugerido,
    valorFinal,
    origem: p.origem,
    formaPagamento: p.formaPagamento,
    parcelas: p.parcelas,
    prazoExecucao: p.prazoExecucao,
    validade: p.validade,
    premissas: p.premissas,
    exclusoes: p.exclusoes,
    observacoes: p.observacoes,
    responsavelId: p.responsavelId,
    responsavelNome: p.responsavelNome,
  })
}
