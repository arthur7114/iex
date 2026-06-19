import { createClient } from "@/lib/supabase/client"
import { registrarLogSeguro } from "./logs"

export interface ModeloProposta {
  id: string
  nome: string
  premissas: string | null
  exclusoes: string | null
  formaPagamentoPadrao: string | null
  prazoExecucaoPadrao: string | null
  validadePadrao: string | null
  padrao: boolean
}

function toModelo(r: any): ModeloProposta {
  return {
    id: r.id,
    nome: r.nome,
    premissas: r.premissas,
    exclusoes: r.exclusoes,
    formaPagamentoPadrao: r.forma_pagamento_padrao,
    prazoExecucaoPadrao: r.prazo_execucao_padrao,
    validadePadrao: r.validade_padrao,
    padrao: r.padrao,
  }
}

export async function listarModelos(): Promise<ModeloProposta[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("modelos_proposta").select("*").order("padrao", { ascending: false }).order("nome")
  if (error) throw error
  return (data ?? []).map(toModelo)
}

export async function getModeloPadrao(): Promise<ModeloProposta | null> {
  const supabase = createClient()
  const { data } = await supabase.from("modelos_proposta").select("*").eq("padrao", true).limit(1).maybeSingle()
  return data ? toModelo(data) : null
}

export async function criarModelo(input: Partial<ModeloProposta> & { nome: string }): Promise<ModeloProposta> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("modelos_proposta")
    .insert({
      nome: input.nome,
      premissas: input.premissas ?? null,
      exclusoes: input.exclusoes ?? null,
      forma_pagamento_padrao: input.formaPagamentoPadrao ?? null,
      prazo_execucao_padrao: input.prazoExecucaoPadrao ?? null,
      validade_padrao: input.validadePadrao ?? null,
      padrao: input.padrao ?? false,
    })
    .select("*")
    .single()
  if (error) throw error
  await registrarLogSeguro("Cadastro de modelo de proposta", { entidade: input.nome })
  return toModelo(data)
}

export async function atualizarModelo(id: string, input: Partial<ModeloProposta>): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.nome !== undefined) patch.nome = input.nome
  if (input.premissas !== undefined) patch.premissas = input.premissas
  if (input.exclusoes !== undefined) patch.exclusoes = input.exclusoes
  if (input.formaPagamentoPadrao !== undefined) patch.forma_pagamento_padrao = input.formaPagamentoPadrao
  if (input.prazoExecucaoPadrao !== undefined) patch.prazo_execucao_padrao = input.prazoExecucaoPadrao
  if (input.validadePadrao !== undefined) patch.validade_padrao = input.validadePadrao
  if (input.padrao !== undefined) patch.padrao = input.padrao
  const { error } = await supabase.from("modelos_proposta").update(patch).eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Edição de modelo de proposta", { entidadeId: id })
}

export async function excluirModelo(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("modelos_proposta").delete().eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Exclusão de modelo de proposta", { entidadeId: id })
}
