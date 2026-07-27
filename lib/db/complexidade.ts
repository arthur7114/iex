import { createClient } from "@/lib/supabase/client"
import type { VariavelComplexidade } from "./types"
import { registrarLogSeguro } from "./logs"
export { calcularMultiplicador, calcularValorSugerido } from "@/lib/propostas/precificacao"

export async function listarVariaveis(incluirInativas = false): Promise<VariavelComplexidade[]> {
  const supabase = createClient()
  let query = supabase
    .from("variaveis_complexidade")
    .select("id,chave,nome,descricao,opcoes,ordem,ativo")
    .order("ordem")
  if (!incluirInativas) query = query.eq("ativo", true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as VariavelComplexidade[]
}

export async function atualizarImpacto(
  id: string,
  opcoes: Record<string, number>,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("variaveis_complexidade").update({ opcoes }).eq("id", id)
  if (error) throw error
  await registrarLogSeguro("Fator de complexidade atualizado", { entidade: "Configurações", entidadeId: id })
}

// slug simples para a chave da variável.
function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 40)
}

// Cria uma nova variável de complexidade (PRD 11.5).
export async function criarVariavel(input: {
  nome: string
  descricao?: string
  opcoes: Record<string, number>
}): Promise<VariavelComplexidade> {
  const supabase = createClient()
  const { data: max } = await supabase
    .from("variaveis_complexidade")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = {
    chave: slugify(input.nome) || `var_${(max?.ordem ?? 0) + 1}`,
    nome: input.nome,
    descricao: input.descricao ?? null,
    opcoes: input.opcoes,
    ordem: (max?.ordem ?? 0) + 1,
    ativo: true,
  }
  const { data, error } = await supabase
    .from("variaveis_complexidade")
    .insert(row)
    .select("id,chave,nome,descricao,opcoes,ordem,ativo")
    .single()
  if (error) throw error
  await registrarLogSeguro("Cadastro de variável de complexidade", { entidade: input.nome, detalhe: "Variável criada" })
  return data as VariavelComplexidade
}

export async function definirAtivoVariavel(id: string, ativo: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("variaveis_complexidade").update({ ativo }).eq("id", id)
  if (error) throw error
  await registrarLogSeguro(ativo ? "Variável de complexidade reativada" : "Variável de complexidade desativada", {
    entidade: "Configurações",
    entidadeId: id,
  })
}
