# Design — Copiloto de precificação (IA) · PRD 006

> Status: aprovado para planejamento (29/06/2026). Fase 3 (IA) do roadmap.
> Escopo escolhido: **copiloto de precificação** (não geração de texto da proposta).

## 1. Objetivo

Ativar a parte de IA do wizard de propostas como um **copiloto de precificação consultivo**:
dado o projeto em elaboração (obra + disciplinas + complexidade + total calculado pelo motor
determinístico) e o histórico de propostas comparáveis, a IA produz:

- mensagens consultivas (insights e alertas de risco);
- um nível de **confiança** (0–100%);
- opcionalmente uma **faixa de preço sugerida** com racional.

**Princípio inegociável (PRD/contrato de mock): _rastreabilidade > automação_.** O copiloto é
apoio — ele explica, sinaliza e recomenda, mas **nunca** altera valores sozinho. A definição
final de preço, condições e envio é sempre do usuário.

## 2. Arquitetura

### 2.1 Server action (chave nunca chega ao browser)

A `OPENAI_API_KEY` é secreta e o app hoje é 100% client-side (browser → Supabase com RLS).
Portanto a chamada à OpenAI roda no servidor. O repositório já tem o padrão exato para
"API externa + chave secreta": `lib/actions/email.ts` é `"use server"`, lê `RESEND_API_KEY`
de `process.env` e **degrada graciosamente** (`simulado`) quando a chave falta.

Novo arquivo **`lib/actions/copiloto.ts`** (`"use server"`) seguindo esse padrão:

- Lê `OPENAI_API_KEY` e `OPENAI_MODEL` (default `gpt-4o-mini`) de `process.env`.
- Recebe o contexto do projeto vindo do wizard (ver `CopilotoInput` abaixo).
- Busca **propostas comparáveis** no servidor via `lib/supabase/server.ts` (`createClient()`,
  respeita RLS da sessão do usuário): últimos 12 meses, mesmo `tipo` de empreendimento,
  status `Aprovada`/`Enviada` → calcula mediana e faixa de R$/m².
- Chama a OpenAI com **saída estruturada (JSON schema)** e retorna `CopilotoResultado`.
- **Fallback determinístico**: se `OPENAI_API_KEY` ausente (ou erro na API), retorna uma
  análise heurística (total calculado vs. mediana histórica + flags básicas de complexidade/
  urgência), marcada `fonte: "heuristica"`. O painel nunca quebra no beta. Espelha o
  `simulado` do e-mail.
- Registra a ação na auditoria via RPC `fn_log_uso` (usando o client servidor, que herda
  `auth.uid()` da sessão). Ação: `"Análise de precificação (IA)"`. Falha de log não quebra
  a análise (padrão `registrarLogSeguro`).

*Alternativas descartadas:* Route Handler dedicado e Supabase Edge Function. O padrão de
server action já existe no repo (`email`, `equipe`, `uploads`), mantém um único deploy
(Vercel) e reaproveita `lib/supabase/server.ts`.

### 2.2 Contratos (tipos)

```ts
// entrada montada pelo wizard na etapa Precificação
interface CopilotoInput {
  tipo: string                 // tipo de empreendimento (p/ comparáveis)
  area: number                 // m²
  padrao?: string
  fase?: string
  urgencia: string
  multiplicadorComplexidade: number
  pulouComplexidade: boolean
  disciplinas: { nome: string; sugerido: number }[]
  totalSugerido: number
}

type CopilotoTone = "info" | "positive" | "caution"

interface CopilotoResultado {
  fonte: "ia" | "heuristica"
  confianca: number            // 0–100
  mensagens: { tone: CopilotoTone; text: string }[]
  faixaSugerida?: { min: number; max: number; racional: string }
  comparaveis: { quantidade: number; medianaReaisM2: number | null }
}
```

`CopilotMessage`/`CopilotTone` já existem em `components/ai-copilot-panel.tsx` e são
reaproveitados (mesma forma `{ tone, text }`).

### 2.3 Chamada OpenAI

- Dependência nova: `openai` (pnpm).
- Modelo default `gpt-4o-mini` (barato, suporta structured outputs), configurável por
  `OPENAI_MODEL`.
- Prompt do sistema: define o papel ("copiloto consultivo de precificação de engenharia,
  nunca decisor, foco em rastreabilidade, responda em PT-BR, tom executivo e sóbrio").
- Prompt do usuário: projeto + resumo dos comparáveis (quantidade, mediana R$/m², faixa).
- `response_format` com JSON schema correspondente a `CopilotoResultado` (sem `fonte`/
  `comparaveis`, que o servidor preenche).
- Sem dados sensíveis além do necessário; nenhum PII de cliente enviado (apenas parâmetros
  técnicos e agregados do histórico).

## 3. UI — painel discreto na etapa "Precificação"

Decisão de posicionamento: **painel na etapa Precificação existente** (não cria etapa nova,
não renumera o wizard; mais fiel ao "visualmente discreto" do contrato de mock).

Em `app/propostas/nova/page.tsx`, dentro do bloco `step === 4` (Precificação):

- Botão **"Analisar com o copiloto"** (estado de carregamento via `useTransition`).
- Ao clicar: monta `CopilotoInput` a partir do estado já existente (`itens`, `totalSugerido`,
  `multiplicador`, `tipoEmp`, `area`, `urgencia`, etc.) e chama `analisarPrecificacao`.
- Renderiza o componente existente `<AICopilotPanel messages={...} confianca={...} />` com os
  dados reais, ao lado/abaixo da tabela de preços.
- `faixaSugerida` aparece como **dica** (texto), não aplica valores. O usuário continua
  digitando os valores finais na etapa **Ajustes** (step 5). Sem auto-aplicação.
- Erros: toast (`sonner`, já usado) + painel mostra estado heurístico/indisponível.

`AICopilotPanel` é reaproveitado como está; se preciso, estendido por props (hierarquia de
compatibilidade do contrato de mock), sem refatorar o visual.

## 4. Configuração & segredos

- `OPENAI_API_KEY` e `OPENAI_MODEL` em `.env.local` (gitignored por `.env*.local`). **O
  usuário fornece a chave rotacionada**; nunca é commitada.
- Criar `.env.example` documentando `OPENAI_API_KEY=` e `OPENAI_MODEL=gpt-4o-mini` (junto das
  demais vars já usadas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`).
- ⚠️ A chave colada no chat de origem deve ser **revogada/rotacionada** (já era recomendação
  do roadmap: "Rotacionar chaves coladas no chat após o beta").

## 5. Fora de escopo (primeira entrega)

- Persistir sugestões na tabela `sugestoes` (PRD marca como adiado; a tabela não é referenciada
  no código). Pode virar `lib/db/sugestoes.ts` depois, para trilha de auditoria.
- Ingestão/RAG da base de conhecimento (PRD: "RAG avançado" fora do MVP).
- Aplicar preços automaticamente.
- Geração de **texto** da proposta por IA (escopo alternativo, não escolhido).

## 6. Validação (ordem do AGENTS.md)

1. `pnpm lint` (0 erros)
2. `tsc --noEmit`
3. `pnpm build`
4. Manual:
   - Com `OPENAI_API_KEY` setada: wizard até Precificação → "Analisar com o copiloto" → painel
     popula com mensagens + confiança; log `"Análise de precificação (IA)"` registrado.
   - Sem a chave: retorna análise heurística (`fonte: "heuristica"`), painel funciona, sem erro.
5. Atualizar `docs/12-execution-roadmap.md` (Fase 3 — IA: copiloto de precificação entregue) e
   nota de divergência se o contrato de mock for tocado.

## 7. Unidades e responsabilidades

| Unidade | Faz o quê | Depende de |
| --- | --- | --- |
| `lib/actions/copiloto.ts` | server action: monta prompt, busca comparáveis, chama OpenAI, fallback heurístico, loga | `openai`, `lib/supabase/server.ts`, `fn_log_uso` |
| `components/ai-copilot-panel.tsx` | apresenta mensagens + confiança (já existe) | — |
| `app/propostas/nova/page.tsx` (step 4) | botão + estado + render do painel com dados reais | `lib/actions/copiloto.ts`, `AICopilotPanel` |
| `.env.example` / `.env.local` | documenta e fornece `OPENAI_API_KEY`/`OPENAI_MODEL` | — |
