# Copiloto de precificação (IA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativar o copiloto de precificação por IA na etapa "Precificação" do wizard de propostas — análise consultiva (mensagens + confiança + faixa sugerida) baseada nos parâmetros do projeto e em propostas comparáveis, sem alterar valores automaticamente.

**Architecture:** Lógica pura testável em `lib/copiloto/analise.ts`; uma server action `lib/actions/copiloto.ts` (`"use server"`) que lê `OPENAI_API_KEY` do servidor, busca comparáveis no Supabase, chama a OpenAI com saída JSON e degrada para heurística determinística quando não há chave; a UI reaproveita `components/ai-copilot-panel.tsx` na etapa 4 do wizard.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript, Supabase (`@supabase/ssr`), OpenAI Node SDK (`openai`), Vitest (novo, só para a lógica pura).

## Global Constraints

- **Segredo nunca no cliente nem no repo:** `OPENAI_API_KEY` só em `.env.local` (gitignored por `.env*.local`) e lido via `process.env` em código `"use server"`. Nunca commitar a chave.
- **Princípio do produto:** _rastreabilidade > automação_. O copiloto é consultivo — **nunca** altera valores sozinho. Sem auto-aplicar preços.
- **Degradação graciosa:** sem `OPENAI_API_KEY` (ou erro na API), retornar análise heurística com `fonte: "heuristica"`; a UI nunca quebra. (Espelha o `simulado` de `lib/actions/email.ts`.)
- **Modelo configurável:** default `gpt-4o-mini`, sobrescrito por `OPENAI_MODEL`.
- **Idioma:** todo texto ao usuário e prompts em PT-BR; tom executivo e sóbrio.
- **Sem PII ao modelo:** enviar apenas parâmetros técnicos do projeto e agregados do histórico (nada de nome de cliente/proposta).
- **Validação (ordem AGENTS.md):** `pnpm lint` → `pnpm exec tsc --noEmit` → `pnpm build`.
- **Reuso (contrato de mock):** reaproveitar `components/ai-copilot-panel.tsx`; não refatorar o visual.

---

### Task 1: Lógica pura do copiloto + testes (Vitest)

Módulo sem dependências de Next/OpenAI/Supabase, para permitir teste unitário isolado. Contém os tipos compartilhados, o resumo estatístico dos comparáveis, a análise heurística (fallback) e o saneador da resposta da IA.

**Files:**
- Create: `lib/copiloto/analise.ts`
- Test: `lib/copiloto/analise.test.ts`
- Modify: `package.json` (adicionar devDep `vitest` e script `test`)

**Interfaces:**
- Consumes: nada (módulo base).
- Produces:
  - `type CopilotoTone = "info" | "positive" | "caution"`
  - `interface CopilotoInput { tipo: string; area: number; padrao?: string; fase?: string; urgencia: string; multiplicadorComplexidade: number; pulouComplexidade: boolean; disciplinas: { nome: string; sugerido: number }[]; totalSugerido: number }`
  - `interface PropostaComparavel { area: number; valorFinal: number; valorSugerido: number }`
  - `interface ResumoComparaveis { quantidade: number; medianaReaisM2: number | null }`
  - `interface CopilotoResultado { fonte: "ia" | "heuristica"; confianca: number; mensagens: { tone: CopilotoTone; text: string }[]; faixaSugerida?: { min: number; max: number; racional: string }; comparaveis: ResumoComparaveis }`
  - `resumirComparaveis(comparaveis: PropostaComparavel[]): ResumoComparaveis`
  - `analiseHeuristica(input: CopilotoInput, resumo: ResumoComparaveis): CopilotoResultado`
  - `montarPromptUsuario(input: CopilotoInput, resumo: ResumoComparaveis): string`
  - `normalizarResultadoIA(raw: unknown, resumo: ResumoComparaveis): CopilotoResultado`

- [ ] **Step 1: Adicionar Vitest e script de teste**

Run:
```bash
pnpm add -D vitest
```

Em `package.json`, adicionar a linha `"test"` ao bloco `scripts` (manter as existentes):
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run"
  },
```

- [ ] **Step 2: Escrever os testes que falham**

Create `lib/copiloto/analise.test.ts`:
```ts
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
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "./analise"` / funções não definidas.

- [ ] **Step 4: Implementar o módulo**

Create `lib/copiloto/analise.ts`:
```ts
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
  const mensagens: { tone: CopilotoTone; text: string }[] = []
  const taxaAtual = input.area > 0 ? input.totalSugerido / input.area : 0

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
  if (f && Number(f.min) > 0 && Number(f.max) > 0) {
    faixaSugerida = {
      min: Math.round(Number(f.min)),
      max: Math.round(Number(f.max)),
      racional: typeof f.racional === "string" ? f.racional : "",
    }
  }
  return { fonte: "ia", confianca, mensagens, faixaSugerida, comparaveis: resumo }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `pnpm test`
Expected: PASS (todos os `describe` verdes).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/copiloto/analise.ts lib/copiloto/analise.test.ts
git commit -m "feat(copiloto): lógica pura de análise de precificação + testes (vitest)"
```

---

### Task 2: Server action `analisarPrecificacao` + dependência OpenAI + `.env.example`

A server action que orquestra: busca comparáveis no Supabase, monta o resumo, chama a OpenAI (saída JSON) e, na ausência de chave ou em erro, devolve a heurística. Não há teste unitário aqui (envolve `"use server"`, rede e cliente Supabase com sessão — mockar tudo isso traria pouco valor); a verificação é por `tsc`/`build` + smoke manual descrito abaixo.

**Files:**
- Create: `lib/actions/copiloto.ts`
- Create: `.env.example`
- Modify: `package.json` (dependência `openai`)

**Interfaces:**
- Consumes (de Task 1): `CopilotoInput`, `CopilotoResultado`, `PropostaComparavel`, `resumirComparaveis`, `analiseHeuristica`, `montarPromptUsuario`, `normalizarResultadoIA`.
- Produces: `analisarPrecificacao(input: CopilotoInput): Promise<CopilotoResultado>`.

- [ ] **Step 1: Instalar o SDK da OpenAI**

Run:
```bash
pnpm add openai
```

- [ ] **Step 2: Criar a server action**

Create `lib/actions/copiloto.ts`:
```ts
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
```

- [ ] **Step 3: Criar `.env.example`**

Create `.env.example`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# E-mail (Resend) — opcional; sem isto o envio fica "simulado"
RESEND_API_KEY=
EMAIL_FROM=IEX Propostas <onboarding@resend.dev>

# Copiloto de precificação (OpenAI) — opcional; sem isto o copiloto usa heurística
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

- [ ] **Step 4: Verificar tipos e build**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

Run: `pnpm build`
Expected: build conclui (rotas compiladas, sem erro).

- [ ] **Step 5: Commit**

```bash
git add lib/actions/copiloto.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat(copiloto): server action analisarPrecificacao (OpenAI + fallback heurístico)"
```

---

### Task 3: Wiring na etapa "Precificação" do wizard

Adiciona um botão "Analisar com o copiloto" na etapa 4 (`step === 4`), que chama a server action e renderiza o painel existente com dados reais. A `faixaSugerida` aparece como dica de texto; nenhum valor é aplicado automaticamente.

**Files:**
- Modify: `app/propostas/nova/page.tsx` (imports; estado do copiloto; handler; bloco `step === 4`, por volta de `app/propostas/nova/page.tsx:1015-1052`)

**Interfaces:**
- Consumes (de Task 2 e Task 1): `analisarPrecificacao`, `CopilotoResultado`.
- Consumes (existente): `AICopilotPanel` de `@/components/ai-copilot-panel`; estado `tipoEmp`, `area`, `padrao`, `fase`, `urgencia`, `pularComplexidade`, `complexMultiplier`, `itens` (`{ disciplina, sugerido }`), `totalSugerido`; helper `formatBRL`.
- Produces: nada (folha da árvore).

- [ ] **Step 1: Adicionar imports**

Em `app/propostas/nova/page.tsx`, logo após a linha `import { transicionarStatus } from "@/lib/db/propostas"` (atual `app/propostas/nova/page.tsx:67`), adicionar:
```ts
import { analisarPrecificacao } from "@/lib/actions/copiloto"
import type { CopilotoResultado } from "@/lib/copiloto/analise"
import { AICopilotPanel } from "@/components/ai-copilot-panel"
```

No import existente de `lucide-react` (na mesma página), acrescentar `Sparkles` e `Loader2` à lista de ícones já importados (ex.: `import { FileText, TriangleAlert, Sparkles, Loader2, ... } from "lucide-react"`). Se algum já existir, não duplicar.

- [ ] **Step 2: Adicionar estado e handler do copiloto**

Dentro do componente, junto aos demais `useState` (ex.: perto de `app/propostas/nova/page.tsx:177`), adicionar:
```ts
const [copiloto, setCopiloto] = useState<CopilotoResultado | null>(null)
const [analisando, setAnalisando] = useState(false)
```

E, junto às demais funções `async` do componente (ex.: perto de `handleGerarProposta`), adicionar:
```ts
async function handleAnalisarCopiloto() {
  setAnalisando(true)
  try {
    const r = await analisarPrecificacao({
      tipo: tipoEmp,
      area,
      padrao,
      fase,
      urgencia,
      multiplicadorComplexidade: complexMultiplier,
      pulouComplexidade: pularComplexidade,
      disciplinas: itens.map((i) => ({ nome: i.disciplina, sugerido: i.sugerido })),
      totalSugerido,
    })
    setCopiloto(r)
  } catch {
    toast.error("Não foi possível consultar o copiloto.")
  } finally {
    setAnalisando(false)
  }
}
```

- [ ] **Step 3: Renderizar botão + painel na etapa Precificação**

No bloco `step === 4`, dentro do `<Card>`, logo após o `<div>` do alerta de "TriangleAlert" (atual `app/propostas/nova/page.tsx:1046-1051`) e antes de fechar o `</Card>`, inserir:
```tsx
<div className="space-y-3 border-t border-border pt-4">
  <div className="flex items-center justify-between gap-3">
    <div className="leading-tight">
      <p className="text-sm font-medium text-foreground">Copiloto de precificação</p>
      <p className="text-xs text-muted-foreground">Análise consultiva — você decide o valor final.</p>
    </div>
    <Button variant="outline" size="sm" onClick={handleAnalisarCopiloto} disabled={analisando || !area}>
      {analisando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {analisando ? "Analisando…" : "Analisar com o copiloto"}
    </Button>
  </div>

  {copiloto && (
    <>
      <AICopilotPanel messages={copiloto.mensagens} confianca={copiloto.confianca} />
      {copiloto.faixaSugerida && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Faixa sugerida pelo copiloto:{" "}
            <span className="font-medium text-foreground">
              {formatBRL(copiloto.faixaSugerida.min)} – {formatBRL(copiloto.faixaSugerida.max)}
            </span>
            . {copiloto.faixaSugerida.racional} Ajuste os valores finais na etapa seguinte, se quiser.
          </p>
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Step 4: Verificar tipos, lint e build**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

Run: `pnpm lint`
Expected: 0 erros.

Run: `pnpm build`
Expected: build conclui sem erro.

- [ ] **Step 5: Smoke manual no preview**

Iniciar o dev server (preview_start) e, autenticado, abrir `/propostas/nova`. Avançar o wizard até a etapa **Precificação** (preencher cliente/obra com `tipo`, `área` e ao menos uma disciplina). Clicar **"Analisar com o copiloto"** e confirmar:
- sem `OPENAI_API_KEY` em `.env.local` → painel popula com análise heurística (mensagens + barra de confiança), sem erro no console;
- a `faixaSugerida` (quando houver histórico do mesmo tipo) aparece como dica.

(Verificação opcional com IA real fica para a Task 4, após configurar a chave.)

- [ ] **Step 6: Commit**

```bash
git add app/propostas/nova/page.tsx
git commit -m "feat(copiloto): painel de análise IA na etapa Precificação do wizard"
```

---

### Task 4: Configurar a chave, validar fim-a-fim e atualizar o roadmap

Fechamento: configurar a chave rotacionada localmente, validar o caminho com IA real, e registrar a entrega na fonte de verdade de progresso (AGENTS.md exige atualizar `docs/12-execution-roadmap.md`).

**Files:**
- Modify: `docs/12-execution-roadmap.md`
- (Local, não versionado) `.env.local`

- [ ] **Step 1: Configurar a chave da OpenAI (rotacionada) em `.env.local`**

Garantir que `.env.local` (gitignored) contém a chave **nova/rotacionada** — nunca a colada no chat:
```bash
OPENAI_API_KEY=<chave-rotacionada>
OPENAI_MODEL=gpt-4o-mini
```
Confirmar que `.env.local` NÃO aparece no `git status` (coberto por `.env*.local`).

- [ ] **Step 2: Validar o caminho com IA real**

Reiniciar o dev server (para carregar a nova env), abrir `/propostas/nova`, ir até **Precificação** e clicar **"Analisar com o copiloto"**. Confirmar:
- o painel popula com mensagens geradas pela IA (texto consultivo coerente, em PT-BR);
- não há erro no console / nos logs do servidor;
- em `/logs`, aparece a ação **"Análise de precificação (IA)"**.

Se a OpenAI falhar (ex.: chave inválida), confirmar que o painel ainda popula via heurística (degradação graciosa).

- [ ] **Step 3: Atualizar o roadmap**

Em `docs/12-execution-roadmap.md`, na seção **Fase 3: Inteligência Artificial**, marcar a entrega do copiloto de precificação:
```markdown
### Fase 3: Inteligência Artificial — (em andamento)
- [x] **Copiloto de precificação** (PRD 006): server action `lib/actions/copiloto.ts` (OpenAI, modelo via `OPENAI_MODEL`, default `gpt-4o-mini`), com busca de comparáveis (mesmo tipo, 12 meses) e **fallback heurístico** sem chave. UI: painel `ai-copilot-panel.tsx` na etapa Precificação do wizard. Consultivo (não aplica valores). Auditoria via `fn_log_uso`.
- [ ] Ingestão da base de conhecimento / RAG e persistência em `sugestoes`: futuro.
```

E em **Próxima ação**, substituir o item 3 ("Iniciar Fase 3 (IA)") por uma nota de que o copiloto de precificação foi entregue e os próximos passos de IA (RAG/`sugestoes`) seguem como futuro.

- [ ] **Step 4: Commit**

```bash
git add docs/12-execution-roadmap.md
git commit -m "docs: registra entrega do copiloto de precificação (Fase 3) no roadmap"
```

---

## Notas de verificação final (não são tarefas)

- Padrão de degradação confirmado contra `lib/actions/email.ts` (`simulado`).
- `data_criacao`, `tipo`, `area`, `valor_final`, `valor_sugerido`, `status` confirmados em `lib/db/propostas.ts` (`PropostaRow`). Status `Aprovada`/`Enviada` conforme `StatusProposta`.
- Estado do wizard (`tipoEmp`, `area`, `padrao`, `fase`, `urgencia`, `pularComplexidade`, `complexMultiplier`, `itens`, `totalSugerido`) confirmado em `app/propostas/nova/page.tsx`.
- `AICopilotPanel` aceita `{ messages: CopilotMessage[]; confianca?: number }`, e `CopilotMessage = { tone: "info"|"positive"|"caution"; text }` — compatível com `CopilotoResultado.mensagens`.
