"use server"

import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"
import {
  analiseHeuristica,
  montarPromptUsuario,
  normalizarResultadoIA,
  resumirComparaveis,
  type CopilotoInput,
  type CopilotoResultado,
  type PropostaComparavel,
  type ItemComparavel,
} from "@/lib/copiloto/analise"

const SYSTEM_PROMPT = [
  "Você é um copiloto consultivo de precificação de projetos de engenharia, em português do Brasil.",
  "Você NÃO decide preços: apoia o usuário, que sempre define o valor final. Priorize rastreabilidade e prudência.",
  "Compare o valor sugerido com o histórico fornecido, aponte riscos (urgência, margem, complexidade) e seja objetivo, em tom executivo e sóbrio.",
  "Responda APENAS um JSON com esta forma exata:",
  '{"confianca": number (0-100), "mensagens": [{"tone": "info"|"positive"|"caution", "text": string}], "sugestoesDisciplina": [{"nome": string, "valorUnitarioM2": number, "valorTotal": number, "justificativa": string}], "faixaSugerida": {"min": number, "max": number, "racional": string} | null}',
  "Use 2 a 4 mensagens curtas. Em 'sugestoesDisciplina', use APENAS os nomes de disciplina fornecidos e apenas quando houver histórico comparável — nunca invente valor sem base. 'faixaSugerida' é opcional (use null se não houver base histórica). Não inclua nenhum texto fora do JSON.",
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
      itens.push({
        disciplinaNome: String(i.disciplina_nome ?? ""),
        area,
        valorFinal: Number(i.valor_final) || 0,
        valorSugerido: Number(i.valor_sugerido) || 0,
        recente,
      })
    }
  }
  return { propostas, itens }
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

export async function analisarPrecificacao(input: CopilotoInput): Promise<CopilotoResultado> {
  const { propostas, itens } = await buscarComparaveis(input.tipo)
  const resumo = resumirComparaveis(propostas, itens)

  const apiKey = process.env.OPENAI_API_KEY
  let resultado: CopilotoResultado

  if (!apiKey) {
    resultado = analiseHeuristica(input, resumo)
  } else {
    try {
      const openai = new OpenAI({ apiKey })
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: montarPromptUsuario(input, resumo) },
        ],
      })
      const raw = completion.choices[0]?.message?.content
      const parsed = normalizarResultadoIA(raw ? JSON.parse(raw) : null, resumo)
      // Se a IA não produziu mensagens utilizáveis, cai para a heurística.
      resultado = parsed.mensagens.length > 0 ? parsed : analiseHeuristica(input, resumo)
    } catch {
      resultado = analiseHeuristica(input, resumo)
    }
  }

  await logarAnalise(input, resultado)
  return resultado
}
