import { createClient } from "@/lib/supabase/client"
import type { VariavelComplexidade } from "./types"
import { registrarLogSeguro } from "./logs"

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

export async function definirAtivoVariavel(id: string, ativo: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("variaveis_complexidade").update({ ativo }).eq("id", id)
  if (error) throw error
}

// Calcula o multiplicador a partir das variáveis (banco) e da seleção do usuário.
// selecao: { chave -> opcao }. Variáveis não selecionadas são ignoradas (impacto 0).
export function calcularMultiplicador(
  variaveis: VariavelComplexidade[],
  selecao: Record<string, string>,
): number {
  let impacto = 0
  for (const v of variaveis) {
    const opcao = selecao[v.chave]
    if (opcao && v.opcoes[opcao] !== undefined) impacto += Number(v.opcoes[opcao])
  }
  return 1 + impacto
}

// Valor sugerido: área * base * multiplicador, com piso no mínimo. Base 0 => valor mínimo fixo.
export function calcularValorSugerido(
  areaM2: number,
  baseRateM2: number,
  valorMinimo: number,
  multiplicador: number,
): number {
  if (baseRateM2 === 0) return valorMinimo
  const calculado = areaM2 * baseRateM2 * multiplicador
  return Math.round(Math.max(calculado, valorMinimo))
}
