import { describe, it, expect } from "vitest"
import {
  resumirComparaveis,
  analiseHeuristica,
  normalizarResultadoIA,
  type CopilotoInput,
  type PropostaComparavel,
  type ItemComparavel,
} from "./analise"

const baseInput: CopilotoInput = {
  tipo: "Hospital",
  area: 1000,
  urgencia: "Normal",
  multiplicadorComplexidade: 1,
  pulouComplexidade: false,
  disciplinas: [{ id: "d1", nome: "Elétrica", sugerido: 100000 }],
  totalSugerido: 100000, // 100 R$/m²
}

describe("resumirComparaveis", () => {
  it("retorna resumo vazio quando não há comparáveis", () => {
    expect(resumirComparaveis([], [])).toEqual({
      quantidade: 0,
      quantidadeRecente: 0,
      medianaReaisM2: null,
      baseAntiga: false,
      porDisciplina: [],
    })
  })

  it("ignora comparáveis com área <= 0", () => {
    const props: PropostaComparavel[] = [{ area: 0, valorFinal: 999999, valorSugerido: 999999, recente: true }]
    const r = resumirComparaveis(props, [])
    expect(r.quantidade).toBe(1)
    expect(r.medianaReaisM2).toBeNull()
  })

  it("calcula a mediana de R$/m² (ímpar) usando valorFinal", () => {
    const props: PropostaComparavel[] = [
      { area: 100, valorFinal: 10000, valorSugerido: 0, recente: true }, // 100
      { area: 100, valorFinal: 20000, valorSugerido: 0, recente: true }, // 200
      { area: 100, valorFinal: 30000, valorSugerido: 0, recente: true }, // 300
    ]
    expect(resumirComparaveis(props, []).medianaReaisM2).toBe(200)
  })

  it("usa valorSugerido quando valorFinal <= 0 e tira média no caso par", () => {
    const props: PropostaComparavel[] = [
      { area: 100, valorFinal: 0, valorSugerido: 10000, recente: true }, // 100
      { area: 100, valorFinal: 0, valorSugerido: 30000, recente: true }, // 300
    ]
    expect(resumirComparaveis(props, []).medianaReaisM2).toBe(200)
  })

  it("prioriza os recentes e ignora os antigos quando há amostra recente", () => {
    const props: PropostaComparavel[] = [
      { area: 100, valorFinal: 10000, valorSugerido: 0, recente: true },  // 100
      { area: 100, valorFinal: 90000, valorSugerido: 0, recente: false }, // 900 (deve ser ignorado)
    ]
    const r = resumirComparaveis(props, [])
    expect(r.medianaReaisM2).toBe(100)
    expect(r.quantidadeRecente).toBe(1)
    expect(r.baseAntiga).toBe(false)
  })

  it("cai para dados antigos e marca baseAntiga quando não há recentes", () => {
    const props: PropostaComparavel[] = [
      { area: 100, valorFinal: 20000, valorSugerido: 0, recente: false }, // 200
    ]
    const r = resumirComparaveis(props, [])
    expect(r.medianaReaisM2).toBe(200)
    expect(r.quantidadeRecente).toBe(0)
    expect(r.baseAntiga).toBe(true)
  })

  it("agrupa itens por disciplina e calcula mediana de R$/m² de cada uma", () => {
    const itens: ItemComparavel[] = [
      { disciplinaNome: "Elétrica", area: 100, valorFinal: 5000, valorSugerido: 0, recente: true },  // 50
      { disciplinaNome: "Elétrica", area: 100, valorFinal: 7000, valorSugerido: 0, recente: true },  // 70
      { disciplinaNome: "Hidráulica", area: 100, valorFinal: 3000, valorSugerido: 0, recente: true },// 30
    ]
    const r = resumirComparaveis([], itens)
    const eletrica = r.porDisciplina.find((d) => d.nome === "Elétrica")
    const hidraulica = r.porDisciplina.find((d) => d.nome === "Hidráulica")
    expect(eletrica).toEqual({ nome: "Elétrica", quantidade: 2, quantidadeRecente: 2, medianaReaisM2: 60, baseAntiga: false })
    expect(hidraulica?.medianaReaisM2).toBe(30)
  })
})

describe("analiseHeuristica", () => {
  it("sinaliza positivo quando alinhado à mediana", () => {
    const r = analiseHeuristica(baseInput, {
      quantidade: 3,
      quantidadeRecente: 3,
      medianaReaisM2: 100,
      baseAntiga: false,
      porDisciplina: [],
    })
    expect(r.fonte).toBe("heuristica")
    expect(r.mensagens.some((m) => m.tone === "positive")).toBe(true)
    expect(r.faixaSugerida).toEqual({
      min: 90000,
      max: 110000,
      racional: expect.stringContaining("mediana"),
    })
  })

  it("alerta (caution) quando muito acima da mediana", () => {
    const r = analiseHeuristica(baseInput, {
      quantidade: 2,
      quantidadeRecente: 2,
      medianaReaisM2: 50,
      baseAntiga: false,
      porDisciplina: [],
    }) // atual 100 vs 50
    expect(r.mensagens.some((m) => m.tone === "caution")).toBe(true)
  })

  it("usa confiança baixa e sem faixa quando não há histórico", () => {
    const r = analiseHeuristica(baseInput, { quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false, porDisciplina: [] })
    expect(r.confianca).toBe(35)
    expect(r.faixaSugerida).toBeUndefined()
    expect(r.mensagens.some((m) => m.tone === "info")).toBe(true)
  })

  it("adiciona alerta de urgência alta", () => {
    const r = analiseHeuristica({ ...baseInput, urgencia: "Crítica" }, { quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false, porDisciplina: [] })
    expect(r.mensagens.some((m) => m.text.includes("Crítica"))).toBe(true)
  })

  it("retorna confiança 0 e alerta de área quando área <= 0", () => {
    const r = analiseHeuristica(
      { ...baseInput, area: 0 },
      { quantidade: 3, quantidadeRecente: 3, medianaReaisM2: 100, baseAntiga: false, porDisciplina: [] },
    )
    expect(r.confianca).toBe(0)
    expect(r.faixaSugerida).toBeUndefined()
    expect(r.mensagens.some((m) => m.tone === "caution" && m.text.includes("Área"))).toBe(true)
  })
})

describe("normalizarResultadoIA", () => {
  const resumo = { quantidade: 1, quantidadeRecente: 1, medianaReaisM2: 100, baseAntiga: false, porDisciplina: [] }

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
    expect(r).toEqual({
      fonte: "ia",
      confianca: 0,
      mensagens: [],
      faixaSugerida: undefined,
      comparaveis: resumo,
      sugestoesDisciplina: [],
      perguntas: [],
    })
  })

  it("descarta faixaSugerida com min > max", () => {
    const r = normalizarResultadoIA(
      { confianca: 60, mensagens: [{ tone: "info", text: "x" }], faixaSugerida: { min: 200000, max: 10000, racional: "r" } },
      resumo,
    )
    expect(r.faixaSugerida).toBeUndefined()
  })
})

describe("sugestões por disciplina", () => {
  const resumoComEletrica = {
    quantidade: 2,
    quantidadeRecente: 2,
    medianaReaisM2: 100,
    baseAntiga: false,
    porDisciplina: [
      { nome: "Elétrica", quantidade: 2, quantidadeRecente: 2, medianaReaisM2: 60, baseAntiga: false },
    ],
  }

  it("sugere valor unitário e total por disciplina a partir da mediana histórica", () => {
    const r = analiseHeuristica(baseInput, resumoComEletrica)
    expect(r.sugestoesDisciplina).toEqual([
      {
        nome: "Elétrica",
        valorUnitarioM2: 60,
        valorTotal: 60000, // 60 R$/m² × 1000 m²
        justificativa: expect.stringContaining("2 proposta"),
        baseAntiga: false,
      },
    ])
  })

  it("não sugere disciplina sem histórico comparável", () => {
    const resumoVazio = { quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false, porDisciplina: [] }
    expect(analiseHeuristica(baseInput, resumoVazio).sugestoesDisciplina).toEqual([])
  })

  it("declara quando a sugestão veio de dados antigos", () => {
    const resumoAntigo = {
      ...resumoComEletrica,
      porDisciplina: [{ nome: "Elétrica", quantidade: 1, quantidadeRecente: 0, medianaReaisM2: 60, baseAntiga: true }],
    }
    const s = analiseHeuristica(baseInput, resumoAntigo).sugestoesDisciplina[0]
    expect(s.baseAntiga).toBe(true)
    expect(s.justificativa).toContain("12 meses")
  })

  it("normalizarResultadoIA saneia sugestões por disciplina inválidas", () => {
    const r = normalizarResultadoIA(
      {
        confianca: 60,
        mensagens: [{ tone: "info", text: "x" }],
        sugestoesDisciplina: [
          { nome: "Elétrica", valorUnitarioM2: 60, valorTotal: 60000, justificativa: "ok" },
          { nome: "", valorUnitarioM2: 10, valorTotal: 100, justificativa: "sem nome" },
          { nome: "Hidráulica", valorUnitarioM2: -5, valorTotal: 0, justificativa: "negativo" },
        ],
      },
      resumoComEletrica,
    )
    expect(r.sugestoesDisciplina).toEqual([
      { nome: "Elétrica", valorUnitarioM2: 60, valorTotal: 60000, justificativa: "ok", baseAntiga: false },
    ])
  })
})

describe("perguntas complementares", () => {
  const resumoVazio = { quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false, porDisciplina: [] }

  it("pergunta pelo padrão e pela fase quando não informados", () => {
    const r = analiseHeuristica({ ...baseInput, padrao: undefined, fase: undefined }, resumoVazio)
    expect(r.perguntas.some((p) => p.toLowerCase().includes("padrão"))).toBe(true)
    expect(r.perguntas.some((p) => p.toLowerCase().includes("fase"))).toBe(true)
  })

  it("pergunta sobre complexidade quando a etapa foi pulada", () => {
    const r = analiseHeuristica({ ...baseInput, padrao: "Alto", fase: "Executivo", pulouComplexidade: true }, resumoVazio)
    expect(r.perguntas.some((p) => p.toLowerCase().includes("complexidade"))).toBe(true)
  })

  it("não pergunta nada quando o projeto está completo e há histórico", () => {
    const resumoOk = { quantidade: 3, quantidadeRecente: 3, medianaReaisM2: 100, baseAntiga: false, porDisciplina: [] }
    const r = analiseHeuristica({ ...baseInput, padrao: "Alto", fase: "Executivo" }, resumoOk)
    expect(r.perguntas).toEqual([])
  })

  it("limita a 3 perguntas", () => {
    const r = analiseHeuristica(
      { ...baseInput, area: 0, padrao: undefined, fase: undefined, pulouComplexidade: true },
      resumoVazio,
    )
    expect(r.perguntas.length).toBeLessThanOrEqual(3)
  })

  it("normalizarResultadoIA aceita no máximo 3 perguntas e descarta vazias", () => {
    const r = normalizarResultadoIA(
      { confianca: 50, mensagens: [{ tone: "info", text: "x" }], perguntas: ["a?", "  ", "b?", "c?", "d?"] },
      resumoVazio,
    )
    expect(r.perguntas).toEqual(["a?", "b?", "c?"])
  })
})
