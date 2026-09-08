import { createClient } from "@/lib/supabase/client"
import type { CopilotoInput, CopilotoResultado } from "@/lib/copiloto/analise"
import { computeMetricasIA, type LinhaAderencia, type MetricasIA } from "@/lib/copiloto/metricas"

// Persiste o que o copiloto sugeriu, por disciplina (PRD 14.2). É a base da
// métrica de aderência (PRD 16.4): valor_total_sugerido × proposta_itens.valor_final.
// Gravação por DELETE + INSERT no escopo da proposta: nomes de disciplina podem
// se repetir, então não existe chave natural para upsert. Diferente de
// proposta_itens (0115), que faz seu DELETE + INSERT dentro de uma única
// transação via RPC, aqui são dois round-trips separados do cliente — se o
// DELETE for confirmado e o INSERT falhar, a proposta fica sem nenhuma linha de
// sugestão em vez de com dados inconsistentes: ela some da amostra de
// aderência, mas não corrompe a métrica (falha na direção pretendida).
// Re-finalizar (V2) substitui integralmente as sugestões da V1 — inclusive
// quando a nova análise não produziu nenhuma sugestão, caso em que a proposta
// fica sem linhas em vez de manter uma sugestão antiga sendo comparada com um
// valor_final novo (métrica honesta).
export async function limparSugestoes(propostaId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("sugestoes").delete().eq("proposta_id", propostaId)
  if (error) throw error
}

// A tabela `sugestoes` é anterior às migrations versionadas deste repo (ver
// 0116_sugestoes_ia.sql): os nomes de coluna abaixo são os do banco real —
// `fatores`, `entrada`, `explicacao`, `base_recente`/`base_antiga` (contagens),
// `multiplicador`, `modelo` — e não há `usuario_id` (a autoria fica na
// auditoria de ajustes/logs). Qualquer renomeação aqui quebra silenciosamente:
// a chamada é `.catch`-guardada na finalização.
export async function registrarSugestoes(
  propostaId: string,
  input: CopilotoInput,
  resultado: CopilotoResultado,
): Promise<void> {
  const supabase = createClient()
  await limparSugestoes(propostaId)
  if (!resultado.sugestoesDisciplina.length) return

  // Nome vazio (disciplina desativada) não vira linha: poluiria o agrupamento
  // do histórico e a chave de junção da métrica.
  const sugestoes = resultado.sugestoesDisciplina.filter((s) => s.nome.trim().length > 0)
  if (!sugestoes.length) return

  // Consome os ids na ordem: com nomes repetidos, cada sugestão pega a primeira
  // disciplina ainda não usada com aquele nome, em vez de todas apontarem para a última.
  const disponiveis = input.disciplinas.map((d) => ({ ...d, usado: false }))
  const resolverId = (nome: string) => {
    const alvo = disponiveis.find((d) => !d.usado && d.nome === nome)
    if (!alvo) return null
    alvo.usado = true
    return alvo.id || null
  }

  const rows = sugestoes.map((s) => {
    const hist = resultado.comparaveis.porDisciplina.find((p) => p.nome === s.nome)
    return {
      proposta_id: propostaId,
      disciplina_id: resolverId(s.nome),
      disciplina_nome: s.nome,
      valor_unitario_sugerido: s.valorUnitarioM2,
      valor_total_sugerido: s.valorTotal,
      multiplicador: input.multiplicadorComplexidade,
      fatores: {
        tipo: input.tipo,
        area: input.area,
        padrao: input.padrao ?? null,
        fase: input.fase ?? null,
        urgencia: input.urgencia,
        multiplicadorComplexidade: input.multiplicadorComplexidade,
        pulouComplexidade: input.pulouComplexidade,
      },
      // Snapshot íntegro da entrada da análise: permite reconstruir depois por
      // que a sugestão foi essa, mesmo que os fatores acima mudem de forma.
      entrada: input,
      explicacao: s.justificativa || null,
      confianca: resultado.confianca,
      // Contagens, não flags: `base_antiga` é o número de comparáveis de 12–36
      // meses. O booleano "só tem base antiga" é derivado na leitura
      // (base_recente === 0 && base_antiga > 0), como em getMetricasIA.
      base_recente: hist?.quantidadeRecente ?? 0,
      base_antiga: Math.max(0, (hist?.quantidade ?? 0) - (hist?.quantidadeRecente ?? 0)),
      fonte: resultado.fonte,
      modelo: resultado.modelo ?? null,
    }
  })
  const { error } = await supabase.from("sugestoes").insert(rows)
  if (error) throw error
}

export async function listarSugestoes(propostaId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sugestoes")
    .select("disciplina_nome, valor_unitario_sugerido, valor_total_sugerido, explicacao, confianca, base_recente, base_antiga, fonte, modelo, created_at")
    .eq("proposta_id", propostaId)
    .order("disciplina_nome")
  if (error) throw error
  return data ?? []
}

// Cruza a sugestão da IA com o valor efetivamente praticado no item da proposta.
//
// A JUNÇÃO ACONTECE NO BANCO (view `v_aderencia_ia`, migration 0117), não aqui.
// A versão anterior lia `sugestoes` e `proposta_itens` inteiras, sem limite, e
// cruzava os arrays em JS — o que o teto de linhas do PostgREST (`max-rows`)
// truncava silenciosamente, primeiro em `proposta_itens` (a tabela que cresce
// mais rápido): a junção deixava de achar itens existentes e a métrica passava
// a descrever um recorte arbitrário do banco, sem erro visível. Com a view, o
// navegador recebe só os pares já casados.
//
// A MATEMÁTICA continua aqui, em `computeMetricasIA` (puro e testado): a view
// só pareia linhas, não conhece a tolerância de 2% nem os percentuais.
export async function getMetricasIA(): Promise<MetricasIA> {
  const supabase = createClient()
  const { data } = await supabase
    .from("v_aderencia_ia")
    .select("disciplina_nome, valor_sugerido_ia, valor_final, confianca, base_recente, base_antiga, tem_justificativa, fonte")
  // Falha de leitura degrada para métricas zeradas — o card fica vazio, nenhuma
  // tela quebra (o dashboard chama isto no mount).
  if (!data) return computeMetricasIA([])
  const linhas: LinhaAderencia[] = (data as Record<string, unknown>[]).map((l) => ({
    disciplinaNome: String(l.disciplina_nome ?? ""),
    valorSugeridoIA: Number(l.valor_sugerido_ia) || 0,
    valorFinal: Number(l.valor_final) || 0,
    confianca: Number(l.confianca) || 0,
    // `base_recente`/`base_antiga` são CONTAGENS de comparáveis. "A sugestão se
    // apoia em dados com mais de 12 meses" é derivado: nenhum comparável
    // recente e ao menos um antigo (mesma regra de resumirGrupo em analise.ts).
    baseAntiga: (Number(l.base_recente) || 0) === 0 && (Number(l.base_antiga) || 0) > 0,
    temJustificativa: l.tem_justificativa === true,
    fonte: l.fonte === "ia" ? "ia" : "heuristica",
  }))
  return computeMetricasIA(linhas)
}
