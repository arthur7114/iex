// Lógica pura do copiloto de precificação. SEM dependências de Next/OpenAI/Supabase,
// para permitir teste unitário isolado (vitest).

export type CopilotoTone = "info" | "positive" | "caution"

export interface CopilotoDisciplinaInput {
  id: string
  nome: string
  sugerido: number
}

export interface CopilotoInput {
  tipo: string
  area: number
  padrao?: string
  fase?: string
  urgencia: string
  multiplicadorComplexidade: number
  pulouComplexidade: boolean
  disciplinas: CopilotoDisciplinaInput[]
  totalSugerido: number
}

export interface PropostaComparavel {
  area: number
  valorFinal: number
  valorSugerido: number
  recente: boolean // true = até 12 meses; false = referência secundária (12–36m)
}

export interface ItemComparavel extends PropostaComparavel {
  disciplinaNome: string
}

export interface ResumoDisciplina {
  nome: string
  quantidade: number
  quantidadeRecente: number
  medianaReaisM2: number | null
  baseAntiga: boolean
}

export interface ResumoComparaveis {
  quantidade: number
  quantidadeRecente: number
  medianaReaisM2: number | null
  baseAntiga: boolean
  porDisciplina: ResumoDisciplina[]
}

export interface SugestaoDisciplina {
  nome: string
  valorUnitarioM2: number
  valorTotal: number
  justificativa: string
  baseAntiga: boolean
}

export interface CopilotoResultado {
  fonte: "ia" | "heuristica"
  confianca: number
  mensagens: { tone: CopilotoTone; text: string }[]
  faixaSugerida?: { min: number; max: number; racional: string }
  comparaveis: ResumoComparaveis
  sugestoesDisciplina: SugestaoDisciplina[]
}

const TONES: CopilotoTone[] = ["info", "positive", "caution"]

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

// R$/m² de um comparável: usa valorFinal; cai para valorSugerido se final <= 0.
function taxaM2(c: PropostaComparavel): number {
  if (c.area <= 0) return 0
  return (c.valorFinal > 0 ? c.valorFinal : c.valorSugerido) / c.area
}

function mediana(valores: number[]): number | null {
  const ordenados = valores.filter((t) => t > 0).sort((a, b) => a - b)
  if (ordenados.length === 0) return null
  const meio = Math.floor(ordenados.length / 2)
  const m = ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2
  return Math.round(m)
}

// PRD 006: dados recentes têm prioridade; os antigos só entram como referência
// secundária, e nesse caso a origem precisa ser declarada (baseAntiga).
function resumirGrupo(entradas: PropostaComparavel[]) {
  const recentes = entradas.filter((e) => e.recente)
  const usadas = recentes.length > 0 ? recentes : entradas
  return {
    quantidade: entradas.length,
    quantidadeRecente: recentes.length,
    medianaReaisM2: mediana(usadas.map(taxaM2)),
    baseAntiga: recentes.length === 0 && entradas.length > 0,
  }
}

export function resumirComparaveis(
  propostas: PropostaComparavel[],
  itens: ItemComparavel[],
): ResumoComparaveis {
  const grupos = new Map<string, ItemComparavel[]>()
  for (const i of itens) {
    const atual = grupos.get(i.disciplinaNome)
    if (atual) atual.push(i)
    else grupos.set(i.disciplinaNome, [i])
  }
  const porDisciplina: ResumoDisciplina[] = [...grupos.entries()].map(([nome, lista]) => ({
    nome,
    ...resumirGrupo(lista),
  }))
  return { ...resumirGrupo(propostas), porDisciplina }
}

// Sugestão por disciplina = mediana histórica de R$/m² daquela disciplina
// aplicada à área do projeto. Sem histórico, não se inventa valor (PRD 006:
// "avisar quando a amostra recente for insuficiente").
export function sugerirPorDisciplina(
  input: CopilotoInput,
  resumo: ResumoComparaveis,
): SugestaoDisciplina[] {
  if (input.area <= 0) return []
  return input.disciplinas.flatMap((d) => {
    const hist = resumo.porDisciplina.find((p) => p.nome === d.nome)
    if (!hist || !hist.medianaReaisM2) return []
    const origem = hist.baseAntiga
      ? `sem amostra dos últimos 12 meses; referência secundária de ${hist.quantidade} proposta(s) mais antiga(s)`
      : `${hist.quantidadeRecente} proposta(s) comparável(is) dos últimos 12 meses`
    return [{
      nome: d.nome,
      valorUnitarioM2: hist.medianaReaisM2,
      valorTotal: Math.round(hist.medianaReaisM2 * input.area),
      justificativa: `Mediana de ${fmtBRL(hist.medianaReaisM2)}/m² em ${origem}, aplicada à área de ${input.area} m².`,
      baseAntiga: hist.baseAntiga,
    }]
  })
}

// Análise determinística — usada como fallback quando a IA está indisponível ou falha.
export function analiseHeuristica(input: CopilotoInput, resumo: ResumoComparaveis): CopilotoResultado {
  if (input.area <= 0) {
    return {
      fonte: "heuristica",
      confianca: 0,
      mensagens: [{ tone: "caution", text: "Área não informada. Informe a área do empreendimento para uma análise de precificação." }],
      comparaveis: resumo,
      sugestoesDisciplina: [],
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

  const sugestoesDisciplina = sugerirPorDisciplina(input, resumo)

  return { fonte: "heuristica", confianca, mensagens, faixaSugerida, comparaveis: resumo, sugestoesDisciplina }
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
    `Mediana histórica por disciplina (R$/m², vazio = sem histórico):\n${
      resumo.porDisciplina.length
        ? resumo.porDisciplina
            .map((p) => `- ${p.nome}: ${p.medianaReaisM2 ? fmtBRL(p.medianaReaisM2) : "sem histórico"}${p.baseAntiga ? " (dados com mais de 12 meses)" : ""} · ${p.quantidade} amostra(s)`)
            .join("\n")
        : "- nenhuma"
    }`,
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
  const sugestoesDisciplina: SugestaoDisciplina[] = Array.isArray(obj.sugestoesDisciplina)
    ? (obj.sugestoesDisciplina as unknown[])
        .map((s) => {
          const ss = (s && typeof s === "object" ? s : {}) as Record<string, unknown>
          const nome = typeof ss.nome === "string" ? ss.nome.trim() : ""
          const unit = Number(ss.valorUnitarioM2)
          const total = Number(ss.valorTotal)
          const hist = resumo.porDisciplina.find((p) => p.nome === nome)
          return {
            nome,
            valorUnitarioM2: Math.round(unit),
            valorTotal: Math.round(total),
            justificativa: typeof ss.justificativa === "string" ? ss.justificativa : "",
            baseAntiga: hist?.baseAntiga ?? false,
          }
        })
        .filter((s) => s.nome.length > 0 && s.valorUnitarioM2 > 0 && s.valorTotal > 0)
    : []

  return { fonte: "ia", confianca, mensagens, faixaSugerida, comparaveis: resumo, sugestoesDisciplina }
}
