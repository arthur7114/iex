import { describe, it, expect } from "vitest"
import {
  resumirComparaveis,
  analiseHeuristica,
  normalizarResultadoIA,
  type CopilotoInput,
  type PropostaComparavel,
} from "./analise"

const baseInput: CopilotoInput = {
  tipo: "Hospital",
  area: 1000,
  urgencia: "Normal",
  multiplicadorComplexidade: 1,
  pulouComplexidade: false,
  disciplinas: [{ nome: "Elétrica", sugerido: 100000 }],
  totalSugerido: 100000, // 100 R$/m²
}

describe("resumirComparaveis", () => {
  it("retorna mediana nula quando não há comparáveis", () => {
    expect(resumirComparaveis([])).toEqual({ quantidade: 0, medianaReaisM2: null })
  })

  it("ignora comparáveis com área <= 0", () => {
    const comp: PropostaComparavel[] = [{ area: 0, valorFinal: 999999, valorSugerido: 999999 }]
    expect(resumirComparaveis(comp)).toEqual({ quantidade: 1, medianaReaisM2: null })
  })

  it("calcula a mediana de R$/m² (ímpar) usando valorFinal", () => {
    const comp: PropostaComparavel[] = [
      { area: 100, valorFinal: 10000, valorSugerido: 0 }, // 100
      { area: 100, valorFinal: 20000, valorSugerido: 0 }, // 200
      { area: 100, valorFinal: 30000, valorSugerido: 0 }, // 300
    ]
    expect(resumirComparaveis(comp)).toEqual({ quantidade: 3, medianaReaisM2: 200 })
  })

  it("usa valorSugerido quando valorFinal <= 0 e tira média no caso par", () => {
    const comp: PropostaComparavel[] = [
      { area: 100, valorFinal: 0, valorSugerido: 10000 }, // 100
      { area: 100, valorFinal: 0, valorSugerido: 30000 }, // 300
    ]
    expect(resumirComparaveis(comp)).toEqual({ quantidade: 2, medianaReaisM2: 200 })
  })
})

describe("analiseHeuristica", () => {
  it("sinaliza positivo quando alinhado à mediana", () => {
    const r = analiseHeuristica(baseInput, { quantidade: 3, medianaReaisM2: 100 })
    expect(r.fonte).toBe("heuristica")
    expect(r.mensagens.some((m) => m.tone === "positive")).toBe(true)
    expect(r.faixaSugerida).toEqual({
      min: 90000,
      max: 110000,
      racional: expect.stringContaining("mediana"),
    })
  })

  it("alerta (caution) quando muito acima da mediana", () => {
    const r = analiseHeuristica(baseInput, { quantidade: 2, medianaReaisM2: 50 }) // atual 100 vs 50
    expect(r.mensagens.some((m) => m.tone === "caution")).toBe(true)
  })

  it("usa confiança baixa e sem faixa quando não há histórico", () => {
    const r = analiseHeuristica(baseInput, { quantidade: 0, medianaReaisM2: null })
    expect(r.confianca).toBe(35)
    expect(r.faixaSugerida).toBeUndefined()
    expect(r.mensagens.some((m) => m.tone === "info")).toBe(true)
  })

  it("adiciona alerta de urgência alta", () => {
    const r = analiseHeuristica({ ...baseInput, urgencia: "Crítica" }, { quantidade: 0, medianaReaisM2: null })
    expect(r.mensagens.some((m) => m.text.includes("Crítica"))).toBe(true)
  })

  it("retorna confiança 0 e alerta de área quando área <= 0", () => {
    const r = analiseHeuristica({ ...baseInput, area: 0 }, { quantidade: 3, medianaReaisM2: 100 })
    expect(r.confianca).toBe(0)
    expect(r.faixaSugerida).toBeUndefined()
    expect(r.mensagens.some((m) => m.tone === "caution" && m.text.includes("Área"))).toBe(true)
  })
})

describe("normalizarResultadoIA", () => {
  const resumo = { quantidade: 1, medianaReaisM2: 100 }

  it("saneia tones inválidos para info e descarta mensagens vazias", () => {
    const r = normalizarResultadoIA(
      { confianca: 70, mensagens: [{ tone: "xpto", text: "ok" }, { tone: "caution", text: "  " }] },
      resumo,
    )
    expect(r.fonte).toBe("ia")
    expect(r.mensagens).toEqual([{ tone: "info", text: "ok" }])
  })

  it("limita confiança a 0–100 e aceita faixa válida", () => {
    const r = normalizarResultadoIA(
      { confianca: 250, mensagens: [{ tone: "info", text: "x" }], faixaSugerida: { min: 10, max: 20, racional: "r" } },
      resumo,
    )
    expect(r.confianca).toBe(100)
    expect(r.faixaSugerida).toEqual({ min: 10, max: 20, racional: "r" })
  })

  it("retorna estrutura segura para entrada inválida", () => {
    const r = normalizarResultadoIA(null, resumo)
    expect(r).toEqual({ fonte: "ia", confianca: 0, mensagens: [], faixaSugerida: undefined, comparaveis: resumo })
  })

  it("descarta faixaSugerida com min > max", () => {
    const r = normalizarResultadoIA(
      { confianca: 60, mensagens: [{ tone: "info", text: "x" }], faixaSugerida: { min: 200000, max: 10000, racional: "r" } },
      resumo,
    )
    expect(r.faixaSugerida).toBeUndefined()
  })
})
