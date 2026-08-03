import { createClient } from "@/lib/supabase/client"
import type { CopilotoInput, CopilotoResultado } from "@/lib/copiloto/analise"

// Persiste o que o copiloto sugeriu, por disciplina (PRD 14.2). É a base da
// métrica de aderência (PRD 16.4): valor_total_sugerido × proposta_itens.valor_final.
// Upsert por (proposta, disciplina): re-finalizar a proposta atualiza a linha.
export async function registrarSugestoes(
  propostaId: string,
  usuarioId: string | null,
  input: CopilotoInput,
  resultado: CopilotoResultado,
): Promise<void> {
  if (!resultado.sugestoesDisciplina.length) return
  const supabase = createClient()
  const idPorNome = new Map(input.disciplinas.map((d) => [d.nome, d.id]))
  const rows = resultado.sugestoesDisciplina.map((s) => {
    const hist = resultado.comparaveis.porDisciplina.find((p) => p.nome === s.nome)
    return {
      proposta_id: propostaId,
      disciplina_id: idPorNome.get(s.nome) ?? null,
      disciplina_nome: s.nome,
      valor_unitario_sugerido: s.valorUnitarioM2,
      valor_total_sugerido: s.valorTotal,
      fatores_considerados: {
        tipo: input.tipo,
        area: input.area,
        padrao: input.padrao ?? null,
        fase: input.fase ?? null,
        urgencia: input.urgencia,
        multiplicadorComplexidade: input.multiplicadorComplexidade,
        pulouComplexidade: input.pulouComplexidade,
      },
      justificativa: s.justificativa || null,
      confianca: resultado.confianca,
      base_recente_qtd: hist?.quantidadeRecente ?? 0,
      base_antiga_qtd: Math.max(0, (hist?.quantidade ?? 0) - (hist?.quantidadeRecente ?? 0)),
      base_antiga: s.baseAntiga,
      fonte: resultado.fonte,
      usuario_id: usuarioId,
    }
  })
  const { error } = await supabase
    .from("sugestoes")
    .upsert(rows, { onConflict: "proposta_id,disciplina_nome" })
  if (error) throw error
}

export async function listarSugestoes(propostaId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sugestoes")
    .select("disciplina_nome, valor_unitario_sugerido, valor_total_sugerido, justificativa, confianca, base_antiga, fonte, created_at")
    .eq("proposta_id", propostaId)
    .order("disciplina_nome")
  if (error) throw error
  return data ?? []
}
