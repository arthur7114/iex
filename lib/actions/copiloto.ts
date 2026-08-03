"use server"

import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"
import { exigirSessao } from "./_auth"
import {
  analiseHeuristica,
  montarPromptUsuario,
  normalizarResultadoIA,
  resumirComparaveis,
  type CopilotoInput,
  type CopilotoResultado,
  type PropostaComparavel,
  type ItemComparavel,
  type JustificativaAnterior,
} from "@/lib/copiloto/analise"

const SYSTEM_PROMPT = [
  "Você é um copiloto consultivo de precificação de projetos de engenharia, em português do Brasil.",
  "Você NÃO decide preços: apoia o usuário, que sempre define o valor final. Priorize rastreabilidade e prudência.",
  "Compare o valor sugerido com o histórico fornecido, aponte riscos (urgência, margem, complexidade) e seja objetivo, em tom executivo e sóbrio.",
  "Responda APENAS um JSON com esta forma exata:",
  '{"confianca": number (0-100), "mensagens": [{"tone": "info"|"positive"|"caution", "text": string}], "perguntas": [string], "sugestoesDisciplina": [{"nome": string, "valorUnitarioM2": number, "valorTotal": number, "justificativa": string}], "faixaSugerida": {"min": number, "max": number, "racional": string} | null}',
  "Use 2 a 4 mensagens curtas. Em 'sugestoesDisciplina', use APENAS os nomes de disciplina fornecidos e apenas quando houver histórico comparável — nunca invente valor sem base. 'faixaSugerida' é opcional (use null se não houver base histórica). Não inclua nenhum texto fora do JSON.",
  "Em 'perguntas', faça no máximo 3 perguntas objetivas apenas quando faltar informação crítica para precificar; array vazio se não faltar nada.",
].join(" ")

const MS_MES = 30 * 24 * 60 * 60 * 1000
const JANELA_RECENTE_MESES = 12
const JANELA_TOTAL_MESES = 36

// Busca propostas comparáveis (mesmo tipo, já enviadas/aprovadas) em duas
// janelas: até 12 meses (prioritária) e 12–36 meses (referência secundária).
// Traz também os itens, para permitir comparação por disciplina (PRD 006).
async function buscarComparaveis(
  tipo: string,
): Promise<{ propostas: PropostaComparavel[]; itens: ItemComparavel[] }> {
  if (!tipo) return { propostas: [], itens: [] }
  const supabase = await createClient()
  const agora = Date.now()
  const limiteRecente = agora - JANELA_RECENTE_MESES * MS_MES
  const cutoffTotal = new Date(agora - JANELA_TOTAL_MESES * MS_MES).toISOString()
  const { data, error } = await supabase
    .from("propostas")
    .select("area, valor_final, valor_sugerido, data_criacao, proposta_itens(disciplina_nome, valor_sugerido, valor_final)")
    .eq("tipo", tipo)
    .in("status", ["Aprovada", "Enviada"])
    .gte("data_criacao", cutoffTotal)
    .eq("arquivada", false)
    .limit(120)
  if (error || !data) return { propostas: [], itens: [] }

  const propostas: PropostaComparavel[] = []
  const itens: ItemComparavel[] = []
  for (const r of data as Record<string, unknown>[]) {
    const area = Number(r.area) || 0
    const recente = new Date(String(r.data_criacao)).getTime() >= limiteRecente
    propostas.push({
      area,
      valorFinal: Number(r.valor_final) || 0,
      valorSugerido: Number(r.valor_sugerido) || 0,
      recente,
    })
    for (const i of (r.proposta_itens as Record<string, unknown>[] | null) ?? []) {
      // Item de disciplina desativada pode ter nome vazio: viraria um grupo ""
      // no histórico, sem significado para o usuário.
      const disciplinaNome = String(i.disciplina_nome ?? "").trim()
      if (!disciplinaNome) continue
      itens.push({
        disciplinaNome,
        area,
        valorFinal: Number(i.valor_final) || 0,
        valorSugerido: Number(i.valor_sugerido) || 0,
        recente,
      })
    }
  }
  return { propostas, itens }
}

// Justificativas de ajuste já registradas em propostas do mesmo tipo.
// É o "aprendizado" possível sem RAG (PRD 006). Texto anônimo: nenhum nome de
// cliente ou número de proposta é enviado ao modelo.
async function buscarJustificativas(tipo: string): Promise<JustificativaAnterior[]> {
  if (!tipo) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ajustes_preco")
    .select("disciplina_nome, variacao_pct, justificativa, propostas!inner(tipo)")
    .eq("propostas.tipo", tipo)
    .not("justificativa", "is", null)
    .order("created_at", { ascending: false })
    .limit(15)
  if (error || !data) return []
  return (data as Record<string, unknown>[])
    .map((r) => ({
      disciplinaNome: String(r.disciplina_nome ?? ""),
      variacaoPct: Number(r.variacao_pct) || 0,
      texto: String(r.justificativa ?? "").trim(),
    }))
    .filter((j) => j.texto.length > 0)
}

// Auditoria — não deve quebrar a análise se falhar.
async function logarAnalise(input: CopilotoInput, resultado: CopilotoResultado): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.rpc("fn_log_uso", {
      p_acao: "Análise de precificação (IA)",
      p_entidade: "Proposta",
      p_entidade_id: null,
      p_detalhe: `${input.tipo} · ${input.area} m² · fonte ${resultado.fonte} · confiança ${resultado.confianca}%`,
      p_origem: "Wizard de proposta",
    })
  } catch {
    // ignora falha de auditoria
  }
}

// Resultado degradado (sem I/O externo) usado quando não há sessão: a tela
// continua funcionando e nenhuma chamada paga ao modelo é feita.
function resultadoIndisponivel(motivo: string): CopilotoResultado {
  return {
    fonte: "heuristica",
    confianca: 0,
    mensagens: [{ tone: "caution", text: motivo }],
    comparaveis: { quantidade: 0, quantidadeRecente: 0, medianaReaisM2: null, baseAntiga: false, porDisciplina: [] },
    sugestoesDisciplina: [],
    perguntas: [],
  }
}

export async function analisarPrecificacao(input: CopilotoInput): Promise<CopilotoResultado> {
  // Sem sessão a análise nem começa: evita que um POST anônimo consuma
  // chamadas pagas ao modelo (mesmo guard de email/uploads/equipe).
  const guard = await exigirSessao()
  if (!guard.ok) return resultadoIndisponivel(guard.error)

  const [comparaveis, justificativas] = await Promise.all([
    buscarComparaveis(input.tipo),
    buscarJustificativas(input.tipo),
  ])
  const resumo = resumirComparaveis(comparaveis.propostas, comparaveis.itens)

  const apiKey = process.env.OPENAI_API_KEY
  let resultado: CopilotoResultado

  if (!apiKey) {
    resultado = analiseHeuristica(input, resumo)
  } else {
    try {
      const openai = new OpenAI({ apiKey })
      const modelo = process.env.OPENAI_MODEL || "gpt-4o-mini"
      const completion = await openai.chat.completions.create({
        model: modelo,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: montarPromptUsuario(input, resumo, justificativas) },
        ],
      })
      const raw = completion.choices[0]?.message?.content
      const parsed = normalizarResultadoIA(raw ? JSON.parse(raw) : null, resumo, input)
      // Se a IA não produziu mensagens utilizáveis, cai para a heurística.
      // `modelo` só acompanha o resultado que de fato veio do modelo: na
      // heurística ele fica indefinido (grava null em sugestoes.modelo).
      resultado = parsed.mensagens.length > 0 ? { ...parsed, modelo } : analiseHeuristica(input, resumo)
    } catch {
      resultado = analiseHeuristica(input, resumo)
    }
  }

  await logarAnalise(input, resultado)
  return resultado
}
