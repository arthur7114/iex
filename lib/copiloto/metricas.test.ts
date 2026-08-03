import { describe, it, expect } from "vitest"
import { computeMetricasIA, type LinhaAderencia } from "./metricas"

const linha = (over: Partial<LinhaAderencia> = {}): LinhaAderencia => ({
  disciplinaNome: "Elétrica",
  valorSugeridoIA: 100000,
  valorFinal: 100000,
  confianca: 80,
  baseAntiga: false,
  temJustificativa: false,
  fonte: "ia",
  ...over,
})

describe("computeMetricasIA", () => {
  it("retorna zeros para amostra vazia", () => {
    expect(computeMetricasIA([])).toEqual({
      amostra: 0,
      aderenciaPct: 0,
      alteradosPct: 0,
      variacaoMediaPct: 0,
      justificativasPct: 0,
      baixaConfiancaPct: 0,
      baseAntigaPct: 0,
    })
  })

  it("conta como aderente uma variação dentro de 2%", () => {
    const m = computeMetricasIA([linha({ valorFinal: 101000 })]) // +1%
    expect(m.aderenciaPct).toBe(100)
    expect(m.alteradosPct).toBe(0)
  })

  it("conta como alterado acima de 2% e mede a variação média em módulo", () => {
    const m = computeMetricasIA([linha({ valorFinal: 90000 }), linha({ valorFinal: 110000 })])
    expect(m.aderenciaPct).toBe(0)
    expect(m.alteradosPct).toBe(100)
    expect(m.variacaoMediaPct).toBe(10)
  })

  it("mede justificativas, baixa confiança e uso de base antiga", () => {
    const m = computeMetricasIA([
      linha({ temJustificativa: true, confianca: 30, baseAntiga: true }),
      linha({ temJustificativa: false, confianca: 90, baseAntiga: false }),
    ])
    expect(m.justificativasPct).toBe(50)
    expect(m.baixaConfiancaPct).toBe(50)
    expect(m.baseAntigaPct).toBe(50)
  })

  it("ignora linhas sem valor sugerido (evita divisão por zero)", () => {
    const m = computeMetricasIA([linha({ valorSugeridoIA: 0, valorFinal: 5000 })])
    expect(m.amostra).toBe(0)
  })

  it("conta como aderente exatamente 2% de variação (limite inclusivo)", () => {
    const m = computeMetricasIA([linha({ valorFinal: 102000 })]) // +2%
    expect(m.aderenciaPct).toBe(100)
    expect(m.alteradosPct).toBe(0)
  })

  it("conta como alterado acima de 2% de variação (limite exclusivo)", () => {
    const m = computeMetricasIA([linha({ valorFinal: 102010 })]) // +2.01%
    expect(m.aderenciaPct).toBe(0)
    expect(m.alteradosPct).toBe(100)
  })
})
