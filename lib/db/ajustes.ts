import { createClient } from "@/lib/supabase/client"

export interface AjustePrecoInput {
  disciplinaId?: string | null
  disciplinaNome: string
  valorSugerido: number
  valorFinal: number
  justificativa?: string
}

// Registra na auditoria de precificação (ajustes_preco) os itens que sofreram
// alteração entre o valor sugerido e o final. Rastreabilidade (PRD 005 / 14.3).
export async function registrarAjustes(
  propostaId: string,
  usuarioId: string | null,
  itens: AjustePrecoInput[],
): Promise<void> {
  const supabase = createClient()
  const rows = itens
    .filter((i) => Math.abs(i.valorFinal - i.valorSugerido) > 0.001)
    .map((i) => ({
      proposta_id: propostaId,
      disciplina_id: i.disciplinaId ?? null,
      disciplina_nome: i.disciplinaNome,
      valor_sugerido: i.valorSugerido,
      valor_final: i.valorFinal,
      variacao_pct: i.valorSugerido ? ((i.valorFinal - i.valorSugerido) / i.valorSugerido) * 100 : 0,
      justificativa: i.justificativa || null,
      usuario_id: usuarioId,
    }))
  if (!rows.length) return
  const { error } = await supabase.from("ajustes_preco").insert(rows)
  if (error) throw error
}

export async function listarAjustes(propostaId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("ajustes_preco")
    .select("disciplina_nome, valor_sugerido, valor_final, variacao_pct, justificativa, created_at")
    .eq("proposta_id", propostaId)
    .order("created_at")
  if (error) throw error
  return data ?? []
}
