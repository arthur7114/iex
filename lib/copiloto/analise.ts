// Lógica pura do copiloto de precificação. SEM dependências de Next/OpenAI/Supabase,
// para permitir teste unitário isolado (vitest).

export type CopilotoTone = "info" | "positive" | "caution"

export interface CopilotoInput {
  tipo: string
  area: number
  padrao?: string
  fase?: string
  urgencia: string
  multiplicadorComplexidade: number
  pulouComplexidade: boolean
  disciplinas: { nome: string; sugerido: number }[]
  totalSugerido: number
}

export interface PropostaComparavel {
  area: number
  valorFinal: number
  valorSugerido: number
}

export interface ResumoComparaveis {
  quantidade: number
  medianaReaisM2: number | null
}

export interface CopilotoResultado {
  fonte: "ia" | "heuristica"
  confianca: number
  mensagens: { tone: CopilotoTone; text: string }[]
  faixaSugerida?: { min: number; max: number; racional: string }
  comparaveis: ResumoComparaveis
}

const TONES: CopilotoTone[] = ["info", "positive", "caution"]

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

// Mediana de R$/m² entre comparáveis (usa valorFinal; cai para valorSugerido se final <= 0).
export function resumirComparaveis(comparaveis: PropostaComparavel[]): ResumoComparaveis {
  const taxas = comparaveis
    .filter((c) => c.area > 0)
    .map((c) => (c.valorFinal > 0 ? c.valorFinal : c.valorSugerido) / c.area)
    .filter((t) => t > 0)
    .sort((a, b) => a - b)
  if (taxas.length === 0) return { quantidade: comparaveis.length, medianaReaisM2: null }
  const meio = Math.floor(taxas.length / 2)
  const mediana = taxas.length % 2 ? taxas[meio] : (taxas[meio - 1] + taxas[meio]) / 2
  return { quantidade: comparaveis.length, medianaReaisM2: Math.round(mediana) }
}

// Análise determinística — usada como fallback quando a IA está indisponível ou falha.
export function analiseHeuristica(input: CopilotoInput, resumo: ResumoComparaveis): CopilotoResultado {
  if (input.area <= 0) {
    return {
      fonte: "heuristica",
      confianca: 0,
      mensagens: [{ tone: "caution", text: "Área não informada. Informe a área do empreendimento para uma análise de precificação." }],
      comparaveis: resumo,
    }
  }

  const mensagens: { tone: CopilotoTone; text: string }[] = []
  const taxaAtual = input.totalSugerido / input.area

  if (resumo.medianaReaisM2 && taxaAtual > 0) {
    const desvio = (taxaAtual - resumo.medianaReaisM2) / resumo.medianaReaisM2
    const pct = Math.round(Math.abs(desvio) * 100)
    if (desvio > 0.15) {
      mensagens.push({
        tone: "caution",
        text: `O valor sugerido está ${pct}% acima da mediana de ${resumo.quantidade} proposta(s) comparável(is) de ${input.tipo} (${fmtBRL(resumo.medianaReaisM2)}/m²). Avalie se a complexidade justifica.`,
      })
    } else if (desvio < -0.15) {
      mensagens.push({
        tone: "caution",
        text: `O valor sugerido está ${pct}% abaixo da mediana de comparáveis (${fmtBRL(resumo.medianaReaisM2)}/m²). Confira a margem antes de enviar.`,
      })
    } else {
      mensagens.push({
        tone: "positive",
        text: `O valor está alinhado à mediana de ${resumo.quantidade} comparável(is) de ${input.tipo} (${fmtBRL(resumo.medianaReaisM2)}/m²).`,
      })
    }
  } else {
    mensagens.push({
      tone: "info",
      text: `Sem histórico comparável de ${input.tipo} nos últimos 12 meses; análise baseada apenas nos parâmetros do projeto.`,
    })
  }

  if (input.urgencia === "Alta" || input.urgencia === "Crítica") {
    mensagens.push({
      tone: "caution",
      text: `Urgência ${input.urgencia}: prazos curtos pressionam custo e qualidade — considere refletir isso no valor ou no prazo.`,
    })
  }
  if (input.pulouComplexidade) {
    mensagens.push({
      tone: "info",
      text: "A etapa de complexidade foi pulada (multiplicador 1,0). Revisar os fatores pode refinar o valor sugerido.",
    })
  } else if (input.multiplicadorComplexidade >= 1.2) {
    mensagens.push({
      tone: "info",
      text: `Multiplicador de complexidade alto (${input.multiplicadorComplexidade.toFixed(2)}×) elevou o valor — garanta que o escopo registra essas premissas.`,
    })
  }

  // Confiança: base 45% + 8 p.p. por comparável, teto 85%; 35% sem histórico.
  const confianca = resumo.medianaReaisM2 ? Math.min(85, 45 + resumo.quantidade * 8) : 35

  const faixaSugerida =
    resumo.medianaReaisM2 && input.area > 0
      ? {
          min: Math.round(resumo.medianaReaisM2 * input.area * 0.9),
          max: Math.round(resumo.medianaReaisM2 * input.area * 1.1),
          racional: `Faixa de ±10% sobre a mediana histórica de ${fmtBRL(resumo.medianaReaisM2)}/m² aplicada à área de ${input.area} m².`,
        }
      : undefined

  return { fonte: "heuristica", confianca, mensagens, faixaSugerida, comparaveis: resumo }
}

// Texto enviado ao modelo descrevendo o projeto e o resumo dos comparáveis.
export function montarPromptUsuario(input: CopilotoInput, resumo: ResumoComparaveis): string {
  const disc = input.disciplinas.map((d) => `- ${d.nome}: ${fmtBRL(d.sugerido)}`).join("\n")
  const taxaAtual = input.area > 0 ? Math.round(input.totalSugerido / input.area) : 0
  const hist =
    resumo.medianaReaisM2 !== null
      ? `${resumo.quantidade} proposta(s) comparável(is) de ${input.tipo} nos últimos 12 meses; mediana ${fmtBRL(resumo.medianaReaisM2)}/m².`
      : `Sem histórico comparável de ${input.tipo} nos últimos 12 meses.`
  return [
    `Projeto: ${input.tipo}, ${input.area} m²${input.padrao ? `, padrão ${input.padrao}` : ""}${input.fase ? `, fase ${input.fase}` : ""}.`,
    `Urgência: ${input.urgencia}. Multiplicador de complexidade: ${input.multiplicadorComplexidade.toFixed(2)}× (${input.pulouComplexidade ? "etapa pulada" : "avaliada"}).`,
    `Disciplinas e valores sugeridos pelo motor de precificação:\n${disc}`,
    `Total sugerido: ${fmtBRL(input.totalSugerido)} (${fmtBRL(taxaAtual)}/m²).`,
    `Histórico: ${hist}`,
  ].join("\n\n")
}

// Saneia/valida o JSON devolvido pela IA antes de exibir.
export function normalizarResultadoIA(raw: unknown, resumo: ResumoComparaveis): CopilotoResultado {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const confianca = Math.max(0, Math.min(100, Math.round(Number(obj.confianca) || 0)))
  const mensagens = Array.isArray(obj.mensagens)
    ? (obj.mensagens as unknown[])
        .map((m) => {
          const mm = (m && typeof m === "object" ? m : {}) as Record<string, unknown>
          const tone = TONES.includes(mm.tone as CopilotoTone) ? (mm.tone as CopilotoTone) : "info"
          const text = typeof mm.text === "string" ? mm.text.trim() : ""
          return { tone, text }
        })
        .filter((m) => m.text.length > 0)
    : []
  let faixaSugerida: CopilotoResultado["faixaSugerida"]
  const f = obj.faixaSugerida as Record<string, unknown> | undefined
  if (f && Number(f.min) > 0 && Number(f.max) > 0 && Number(f.max) >= Number(f.min)) {
    faixaSugerida = {
      min: Math.round(Number(f.min)),
      max: Math.round(Number(f.max)),
      racional: typeof f.racional === "string" ? f.racional : "",
    }
  }
  return { fonte: "ia", confianca, mensagens, faixaSugerida, comparaveis: resumo }
}
