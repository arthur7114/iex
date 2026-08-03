// Métricas de aderência ao copiloto (PRD 16.4). Lógica pura, sem I/O.
// Regra crítica do PRD: aderência = manutenção do VALOR sugerido, não ausência
// de edição de texto.

export interface LinhaAderencia {
  disciplinaNome: string
  valorSugeridoIA: number
  valorFinal: number
  confianca: number
  baseAntiga: boolean
  temJustificativa: boolean
  fonte: "ia" | "heuristica"
}

export interface MetricasIA {
  amostra: number
  aderenciaPct: number
  alteradosPct: number
  variacaoMediaPct: number
  justificativasPct: number
  baixaConfiancaPct: number
  baseAntigaPct: number
}

// Tolerância de aderência: até 2% de diferença conta como "manteve o valor".
const TOLERANCIA_PCT = 2
const CONFIANCA_BAIXA = 50

const ZERO: MetricasIA = {
  amostra: 0,
  aderenciaPct: 0,
  alteradosPct: 0,
  variacaoMediaPct: 0,
  justificativasPct: 0,
  baixaConfiancaPct: 0,
  baseAntigaPct: 0,
}

export function computeMetricasIA(linhas: LinhaAderencia[]): MetricasIA {
  const validas = linhas.filter((l) => l.valorSugeridoIA > 0)
  if (validas.length === 0) return ZERO
  const n = validas.length
  const pct = (qtd: number) => Math.round((qtd / n) * 100)
  const variacoes = validas.map((l) => Math.abs((l.valorFinal - l.valorSugeridoIA) / l.valorSugeridoIA) * 100)
  const aderentes = variacoes.filter((v) => v <= TOLERANCIA_PCT).length
  return {
    amostra: n,
    aderenciaPct: pct(aderentes),
    alteradosPct: pct(n - aderentes),
    variacaoMediaPct: Math.round((variacoes.reduce((a, b) => a + b, 0) / n) * 10) / 10,
    justificativasPct: pct(validas.filter((l) => l.temJustificativa).length),
    baixaConfiancaPct: pct(validas.filter((l) => l.confianca < CONFIANCA_BAIXA).length),
    baseAntigaPct: pct(validas.filter((l) => l.baseAntiga).length),
  }
}
