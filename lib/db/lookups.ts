import { createClient } from "@/lib/supabase/client"
import { TABELAS_REF, type CategoriaRef, type OpcaoRef } from "./types"
import { registrarLogSeguro } from "./logs"

const LABEL_CATEGORIA: Record<CategoriaRef, string> = {
  origem_cliente: "Origem de cliente",
  perfil_cliente: "Perfil de cliente",
  tipo_empreendimento: "Tipo de empreendimento",
  motivo_perda: "Motivo de perda",
  forma_pagamento: "Forma de pagamento",
}

// Lista os itens (ativos por padrão) de uma categoria de referência.
export async function listarOpcoes(
  categoria: CategoriaRef,
  incluirInativas = false,
): Promise<OpcaoRef[]> {
  const supabase = createClient()
  let query = supabase.from(TABELAS_REF[categoria]).select("id,nome,ordem,ativo").order("ordem")
  if (!incluirInativas) query = query.eq("ativo", true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as OpcaoRef[]
}

// Carrega todas as listas de uma vez (para formulários do wizard / cadastros).
export async function listarTodasOpcoes(): Promise<Record<CategoriaRef, OpcaoRef[]>> {
  const categorias = Object.keys(TABELAS_REF) as CategoriaRef[]
  const resultados = await Promise.all(categorias.map((c) => listarOpcoes(c)))
  return Object.fromEntries(categorias.map((c, i) => [c, resultados[i]])) as Record<
    CategoriaRef,
    OpcaoRef[]
  >
}

export async function criarOpcao(categoria: CategoriaRef, nome: string): Promise<OpcaoRef> {
  const supabase = createClient()
  const { data: max } = await supabase
    .from(TABELAS_REF[categoria])
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle()
  const ordem = (max?.ordem ?? 0) + 1
  const { data, error } = await supabase
    .from(TABELAS_REF[categoria])
    .insert({ nome, ordem })
    .select("id,nome,ordem,ativo")
    .single()
  if (error) throw error
  await registrarLogSeguro("Cadastro de opção", { entidade: LABEL_CATEGORIA[categoria], detalhe: `Adicionado: ${nome}` })
  return data as OpcaoRef
}

export async function atualizarOpcao(
  categoria: CategoriaRef,
  id: string,
  patch: Partial<Pick<OpcaoRef, "nome" | "ordem" | "ativo">>,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from(TABELAS_REF[categoria]).update(patch).eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Edição de opção", { entidade: LABEL_CATEGORIA[categoria], entidadeId: id, detalhe: patch.nome ? `Renomeado para: ${patch.nome}` : "Atualizado" })
}

// Desativa (soft) uma opção.
export async function desativarOpcao(categoria: CategoriaRef, id: string): Promise<void> {
  return atualizarOpcao(categoria, id, { ativo: false })
}
