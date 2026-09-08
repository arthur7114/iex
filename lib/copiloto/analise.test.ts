import { describe, it, expect } from "vitest"
import {
  resumirComparaveis,
  analiseHeuristica,
  normalizarResultadoIA,
  montarPromptUsuario,
  type CopilotoInput,
  type PropostaComparavel,
  type ItemComparavel,
  type JustificativaAnterior,
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

  // `modelo` identifica QUEM produziu a análise e é gravado em sugestoes.modelo.
  // A heurística não passa por modelo nenhum: marcá-la com um nome de modelo
  // contaminaria a comparação de aderência entre modelos.
  it("não declara modelo (só o caminho de IA preenche esse campo)", () => {
    const r = analiseHeuristica(baseInput, { quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false, porDisciplina: [] })
    expect(r.fonte).toBe("heuristica")
    expect(r.modelo).toBeUndefined()
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
      baseInput,
    )
    expect(r.fonte).toBe("ia")
    expect(r.mensagens).toEqual([{ tone: "info", text: "ok" }])
  })

  it("limita confiança a 0–100 e aceita faixa válida", () => {
    const r = normalizarResultadoIA(
      { confianca: 250, mensagens: [{ tone: "info", text: "x" }], faixaSugerida: { min: 10, max: 20, racional: "r" } },
      resumo,
      baseInput,
    )
    expect(r.confianca).toBe(100)
    expect(r.faixaSugerida).toEqual({ min: 10, max: 20, racional: "r" })
  })

  it("retorna estrutura segura para entrada inválida", () => {
    const r = normalizarResultadoIA(null, resumo, baseInput)
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
      baseInput,
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
      baseInput,
    )
    expect(r.sugestoesDisciplina).toEqual([
      { nome: "Elétrica", valorUnitarioM2: 60, valorTotal: 60000, justificativa: "ok", baseAntiga: false },
    ])
  })

  it("normalizarResultadoIA descarta disciplina que o modelo inventou (sem histórico)", () => {
    const r = normalizarResultadoIA(
      {
        confianca: 80,
        mensagens: [{ tone: "info", text: "x" }],
        sugestoesDisciplina: [
          { nome: "Elétrica", valorUnitarioM2: 60, valorTotal: 60000, justificativa: "ok" },
          // disciplina que não existe em resumo.porDisciplina
          { nome: "Paisagismo", valorUnitarioM2: 40, valorTotal: 40000, justificativa: "alucinada" },
          // existe no resumo, mas sem mediana histórica
          { nome: "Hidráulica", valorUnitarioM2: 30, valorTotal: 30000, justificativa: "sem base" },
        ],
      },
      {
        ...resumoComEletrica,
        porDisciplina: [
          ...resumoComEletrica.porDisciplina,
          { nome: "Hidráulica", quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false },
        ],
      },
      baseInput,
    )
    expect(r.sugestoesDisciplina.map((s) => s.nome)).toEqual(["Elétrica"])
  })

  it("normalizarResultadoIA descarta sugestão com histórico para disciplina não selecionada nesta proposta", () => {
    // "Hidráulica" tem mediana histórica no tipo de empreendimento (resumo), mas
    // não está entre as disciplinas selecionadas nesta proposta (baseInput só
    // tem "Elétrica") — não pode virar sugestão, mesmo sendo um nome válido.
    const resumoComHidraulica = {
      ...resumoComEletrica,
      porDisciplina: [
        ...resumoComEletrica.porDisciplina,
        { nome: "Hidráulica", quantidade: 2, quantidadeRecente: 2, medianaReaisM2: 45, baseAntiga: false },
      ],
    }
    const r = normalizarResultadoIA(
      {
        confianca: 80,
        mensagens: [{ tone: "info", text: "x" }],
        sugestoesDisciplina: [
          { nome: "Elétrica", valorUnitarioM2: 60, valorTotal: 60000, justificativa: "ok" },
          { nome: "Hidráulica", valorUnitarioM2: 45, valorTotal: 45000, justificativa: "não selecionada" },
        ],
      },
      resumoComHidraulica,
      baseInput,
    )
    expect(r.sugestoesDisciplina.map((s) => s.nome)).toEqual(["Elétrica"])
  })

  it("normalizarResultadoIA recalcula o total pelo unitário × área, ignorando a aritmética do modelo", () => {
    const r = normalizarResultadoIA(
      {
        confianca: 80,
        mensagens: [{ tone: "info", text: "x" }],
        // total em unidade errada (como se a área fosse 1)
        sugestoesDisciplina: [{ nome: "Elétrica", valorUnitarioM2: 60, valorTotal: 60, justificativa: "ok" }],
      },
      resumoComEletrica,
      baseInput,
    )
    expect(r.sugestoesDisciplina[0].valorTotal).toBe(60000)
  })

  it("sugere apenas as disciplinas com histórico, preservando a ordem de entrada", () => {
    const input: CopilotoInput = {
      ...baseInput,
      disciplinas: [
        { id: "d1", nome: "Elétrica", sugerido: 100000 },
        { id: "d2", nome: "Hidráulica", sugerido: 50000 },
        { id: "d3", nome: "Estrutural", sugerido: 80000 },
      ],
      totalSugerido: 230000,
    }
    const resumo = {
      quantidade: 3,
      quantidadeRecente: 3,
      medianaReaisM2: 100,
      baseAntiga: false,
      porDisciplina: [
        // fora da ordem de entrada de propósito: quem manda é a ordem das disciplinas
        { nome: "Estrutural", quantidade: 1, quantidadeRecente: 1, medianaReaisM2: 80, baseAntiga: false },
        { nome: "Elétrica", quantidade: 2, quantidadeRecente: 2, medianaReaisM2: 60, baseAntiga: false },
        // sem mediana: não deve virar sugestão
        { nome: "Hidráulica", quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false },
      ],
    }
    const s = analiseHeuristica(input, resumo).sugestoesDisciplina
    expect(s.map((x) => x.nome)).toEqual(["Elétrica", "Estrutural"])
    expect(s.map((x) => x.valorTotal)).toEqual([60000, 80000])
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
      baseInput,
    )
    expect(r.perguntas).toEqual(["a?", "b?", "c?"])
  })
})

describe("montarPromptUsuario", () => {
  const resumoVazio = { quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false, porDisciplina: [] }

  it("inclui as justificativas anteriores quando existem", () => {
    const texto = montarPromptUsuario(baseInput, resumoVazio, [
      { disciplinaNome: "Elétrica", variacaoPct: -12.5, texto: "Cliente recorrente, desconto negociado." },
    ])
    expect(texto).toContain("Elétrica")
    expect(texto).toContain("Cliente recorrente")
    expect(texto).toContain("-12.5")
  })

  it("declara ausência de justificativas quando a lista está vazia", () => {
    const texto = montarPromptUsuario(baseInput, resumoVazio, [])
    expect(texto).toContain("Sem justificativas de ajuste registradas")
  })

  it("usa a redação de referência secundária quando a mediana veio de base antiga", () => {
    const texto = montarPromptUsuario(
      baseInput,
      { quantidade: 2, quantidadeRecente: 0, medianaReaisM2: 100, baseAntiga: true, porDisciplina: [] },
      [],
    )
    expect(texto).toContain("Referência secundária")
    expect(texto).toContain("mais de 12 meses")
  })

  it("mantém a redação de base recente quando há amostra dos últimos 12 meses", () => {
    const texto = montarPromptUsuario(
      baseInput,
      { quantidade: 2, quantidadeRecente: 2, medianaReaisM2: 100, baseAntiga: false, porDisciplina: [] },
      [],
    )
    expect(texto).toContain("2 proposta(s) comparável(is) de Hospital nos últimos 12 meses")
  })
})

describe("base antiga no nível da proposta", () => {
  const resumoAntigo = {
    quantidade: 2,
    quantidadeRecente: 0,
    medianaReaisM2: 100,
    baseAntiga: true,
    porDisciplina: [],
  }

  it("declara a base antiga no racional da faixa sugerida", () => {
    const r = analiseHeuristica({ ...baseInput, padrao: "Alto", fase: "Executivo" }, resumoAntigo)
    expect(r.faixaSugerida?.racional).toContain("mais de 12 meses")
  })

  it("não declara base antiga quando a amostra é recente", () => {
    const r = analiseHeuristica(baseInput, { ...resumoAntigo, quantidadeRecente: 2, baseAntiga: false })
    expect(r.faixaSugerida?.racional).not.toContain("mais de 12 meses")
  })

  it("a pergunta sobre base antiga sobrevive ao teto de 3 perguntas", () => {
    const r = analiseHeuristica(
      { ...baseInput, area: 0, padrao: undefined, fase: undefined, pulouComplexidade: true },
      resumoAntigo,
    )
    expect(r.perguntas.length).toBe(3)
    expect(r.perguntas[0]).toContain("últimos 12 meses")
  })
})
