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
} from "@/lib/copiloto/analise"

const SYSTEM_PROMPT = [
  "Você é um copiloto consultivo de precificação de projetos de engenharia, em português do Brasil.",
  "Você NÃO decide preços: apoia o usuário, que sempre define o valor final. Priorize rastreabilidade e prudência.",
  "Compare o valor sugerido com o histórico fornecido, aponte riscos (urgência, margem, complexidade) e seja objetivo, em tom executivo e sóbrio.",
  "Responda APENAS um JSON com esta forma exata:",
  '{"confianca": number (0-100), "mensagens": [{"tone": "info"|"positive"|"caution", "text": string}], "faixaSugerida": {"min": number, "max": number, "racional": string} | null}',
  "Use 2 a 4 mensagens curtas. 'faixaSugerida' é opcional (use null se não houver base histórica). Não inclua nenhum texto fora do JSON.",
].join(" ")

// Busca propostas comparáveis (mesmo tipo, últimos 12 meses, já enviadas/aprovadas).
async function buscarComparaveis(tipo: string): Promise<PropostaComparavel[]> {
  if (!tipo) return []
  const supabase = await createClient()
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("propostas")
    .select("area, valor_final, valor_sugerido")
    .eq("tipo", tipo)
    .in("status", ["Aprovada", "Enviada"])
    .gte("data_criacao", cutoff)
    .eq("arquivada", false)
    .limit(50)
  if (error || !data) return []
  return data.map((r) => ({
    area: Number(r.area) || 0,
    valorFinal: Number(r.valor_final) || 0,
    valorSugerido: Number(r.valor_sugerido) || 0,
  }))
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
  const comparaveis = await buscarComparaveis(input.tipo)
  const resumo = resumirComparaveis(comparaveis)

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
