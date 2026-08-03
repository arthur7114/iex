import { createClient } from "@/lib/supabase/client"
import type { CopilotoInput, CopilotoResultado } from "@/lib/copiloto/analise"
import { computeMetricasIA, type LinhaAderencia, type MetricasIA } from "@/lib/copiloto/metricas"

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

// Cruza a sugestão da IA com o valor efetivamente praticado no item da proposta.
export async function getMetricasIA(): Promise<MetricasIA> {
  const supabase = createClient()
  const [{ data: sugs }, { data: itens }] = await Promise.all([
    supabase.from("sugestoes").select("proposta_id, disciplina_nome, valor_total_sugerido, confianca, base_antiga, fonte"),
    supabase.from("proposta_itens").select("proposta_id, disciplina_nome, valor_final, justificativa"),
  ])
  if (!sugs || !itens) return computeMetricasIA([])
  const chave = (p: unknown, d: unknown) => `${String(p)}|${String(d)}`
  const porChave = new Map(
    (itens as Record<string, unknown>[]).map((i) => [chave(i.proposta_id, i.disciplina_nome), i]),
  )
  const linhas: LinhaAderencia[] = (sugs as Record<string, unknown>[]).flatMap((s) => {
    const item = porChave.get(chave(s.proposta_id, s.disciplina_nome))
    if (!item) return []
    return [{
      disciplinaNome: String(s.disciplina_nome),
      valorSugeridoIA: Number(s.valor_total_sugerido) || 0,
      valorFinal: Number(item.valor_final) || 0,
      confianca: Number(s.confianca) || 0,
      baseAntiga: Boolean(s.base_antiga),
      temJustificativa: String(item.justificativa ?? "").trim().length > 0,
      fonte: s.fonte === "ia" ? "ia" : "heuristica",
    }]
  })
  return computeMetricasIA(linhas)
}
