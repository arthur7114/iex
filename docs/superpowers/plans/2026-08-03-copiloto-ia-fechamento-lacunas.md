# Fechamento das lacunas do Copiloto de IA (PRD 006) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o copiloto de precificação do estado atual (comparação de total + mensagens consultivas) ao escopo completo do PRD 006 — sugestão por disciplina, perguntas complementares, distinção base recente/antiga, persistência em `sugestoes` e métricas de aderência.

**Architecture:** A lógica continua pura e testável em `lib/copiloto/*` (vitest), a I/O fica na server action `lib/actions/copiloto.ts` e num novo módulo de escrita `lib/db/sugestoes.ts`. A persistência da sugestão acontece na **finalização** da proposta (quando `proposta_id` já existe), junto de `registrarAjustes` — não no momento da análise, em que a proposta ainda não foi criada. As métricas (PRD 16.4) leem `sugestoes` × `proposta_itens`.

**Tech Stack:** Next.js 16 (App Router, server actions), TypeScript, Supabase (Postgres + RLS), OpenAI SDK, vitest, Tailwind + shadcn/ui.

## Global Constraints

- **Rastreabilidade > automação.** O copiloto **nunca** escreve valores em `valoresFinais`/`itens`. Toda sugestão é exibida como texto/dica; o usuário digita o valor final na etapa Ajustes. (PRD 5.1, 006 "Conduta da IA")
- **Degradação graciosa obrigatória.** Sem `OPENAI_API_KEY`, com erro de rede ou com JSON inválido, a análise cai na heurística determinística (`fonte: "heuristica"`). Nenhuma tela pode quebrar.
- **Dados recentes primeiro.** Janela recente = **12 meses**. Dados de 12 a 36 meses são referência **secundária** e, quando usados, precisam ser declarados na UI (`baseAntiga`). Nada acima de 36 meses entra.
- **Nenhum PII de cliente vai para a OpenAI.** Só parâmetros técnicos (tipo, área, padrão, fase, urgência, disciplinas, valores) e agregados do histórico. Justificativas de ajuste são enviadas como texto anônimo, sem nome de cliente ou número de proposta.
- **Migrations são aditivas e idempotentes**, seguem o estilo de `0114_notificacoes.sql`: `begin;` … `create table if not exists`, RLS `auth_all` via `do $$ … pg_policies`, registro em `public._iex_migrations`, `commit;`.
- **Segredos** (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) só em `.env.local`, nunca commitados.
- **Ordem de validação** (AGENTS.md): `pnpm lint` → `npx tsc --noEmit` → `pnpm build` → validação de banco. `pnpm test` roda vitest.
- **Mock Contract Rule** (AGENTS.md): qualquer divergência visual do mock precisa ser declarada em `docs/12-execution-roadmap.md` antes de fechar o ciclo. Este plano introduz duas: (a) painel do copiloto ganha lista de sugestões por disciplina e bloco de perguntas; (b) dashboard ganha um card "Aderência ao copiloto". Ambas são **adições**, nenhuma tela é removida.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/0116_sugestoes_ia.sql` | Tabela `sugestoes` (PRD 14.2) + índices + RLS | 1 |
| `scripts/validate-migration-0116.mjs` | Confirma que a migration aplicou (colunas, índices, RLS) | 1 |
| `lib/copiloto/analise.ts` | Lógica pura: resumos, heurística, prompt, normalização do JSON da IA | 2, 3, 4, 5 |
| `lib/copiloto/analise.test.ts` | Testes da lógica pura | 2, 3, 4, 5 |
| `lib/copiloto/metricas.ts` | Cálculo puro das métricas de aderência (PRD 16.4) | 8 |
| `lib/copiloto/metricas.test.ts` | Testes das métricas | 8 |
| `lib/actions/copiloto.ts` | Server action: busca comparáveis/justificativas, chama OpenAI, fallback, log | 2, 5 |
| `lib/db/sugestoes.ts` | Escrita/leitura de `sugestoes` | 7, 8 |
| `components/ai-copilot-panel.tsx` | Apresentação: mensagens, confiança, sugestões por disciplina, perguntas | 6 |
| `components/metricas-ia-card.tsx` | Card de aderência no dashboard | 8 |
| `app/propostas/nova/page.tsx` | Estado do copiloto, render, persistência na finalização | 6, 7 |
| `app/page.tsx` | Monta o card de métricas | 8 |
| `docs/01-prd.md`, `docs/12-execution-roadmap.md`, `docs/13-qa-roteiro-onda3.md` | Documentação e divergências | 9 |

---

### Task 1: Tabela `sugestoes` (PRD 14.2)

> ⚠️ **SUPERADA (03/08/2026).** A premissa desta task estava errada: a tabela
> `sugestoes` **já existia** no banco, do build original, com outros nomes de
> coluna (`fatores`, `explicacao`, `base_recente`, `base_antiga` como *integer*,
> sem `usuario_id`, `disciplina_id` como *text*). O SQL e a lista de 15 colunas
> abaixo estão **incorretos** — não copie deles. O estado real está em
> `supabase/migrations/0116_sugestoes_ia.sql` e na seção "Descoberta importante
> (03/08/2026)" de `docs/12-execution-roadmap.md`.

Sem esta tabela nenhuma métrica do PRD 16.4 é calculável. É a fundação das Tasks 7 e 8.

**Files:**
- Create: `supabase/migrations/0116_sugestoes_ia.sql`
- Create: `scripts/validate-migration-0116.mjs`

**Interfaces:**
- Consumes: tabelas existentes `public.propostas`, `public.disciplinas`, `public.usuarios`, função `public.set_updated_at()`, tabela `public._iex_migrations`.
- Produces: tabela `public.sugestoes` com as colunas `id, proposta_id, disciplina_id, disciplina_nome, valor_unitario_sugerido, valor_total_sugerido, fatores_considerados, justificativa, confianca, base_recente_qtd, base_antiga_qtd, base_antiga, fonte, usuario_id, created_at`. As Tasks 7 e 8 escrevem/leem exatamente esses nomes.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0116_sugestoes_ia.sql`:

```sql
-- 0116_sugestoes_ia.sql
-- Fase 3 (IA) — Persistência das sugestões do copiloto (PRD 006 / 14.2).
--  * sugestoes: uma linha por disciplina sugerida, gravada na FINALIZAÇÃO da
--    proposta (quando proposta_id já existe), junto da auditoria de ajustes.
--    Guarda o que a IA sugeriu para permitir medir aderência (PRD 16.4):
--    valor_total_sugerido (IA) × proposta_itens.valor_final (usuário).
--  * base_recente_qtd / base_antiga_qtd / base_antiga: rastreiam se a sugestão
--    veio de dados dos últimos 12 meses ou de referência secundária (12–36m),
--    exigência explícita do PRD 006 ("declarar quando usa dados antigos").
--  * fonte: 'ia' | 'heuristica' — separa aderência do modelo da aderência do
--    fallback determinístico nas métricas.
--  Migração ADITIVA e idempotente (segue o estilo de 0113/0114/0115).
begin;

create table if not exists public.sugestoes (
  id                       uuid primary key default gen_random_uuid(),
  proposta_id              uuid not null references public.propostas(id) on delete cascade,
  disciplina_id            uuid references public.disciplinas(id) on delete set null,
  disciplina_nome          text not null,
  valor_unitario_sugerido  numeric(14,2) not null default 0,
  valor_total_sugerido     numeric(14,2) not null default 0,
  fatores_considerados     jsonb not null default '{}'::jsonb,
  justificativa            text,
  confianca                integer not null default 0,
  base_recente_qtd         integer not null default 0,
  base_antiga_qtd          integer not null default 0,
  base_antiga              boolean not null default false,
  fonte                    text not null default 'heuristica',
  usuario_id               uuid references public.usuarios(id) on delete set null,
  created_at               timestamptz not null default now()
);

create index if not exists idx_sugestoes_proposta on public.sugestoes (proposta_id);
create index if not exists idx_sugestoes_created on public.sugestoes (created_at desc);
create index if not exists idx_sugestoes_fonte on public.sugestoes (fonte);

-- Uma sugestão por (proposta, disciplina): re-finalizar a proposta atualiza a
-- linha em vez de duplicar, mantendo a métrica de aderência estável.
create unique index if not exists uq_sugestoes_proposta_disciplina
  on public.sugestoes (proposta_id, disciplina_nome);

alter table public.sugestoes enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sugestoes' and policyname = 'auth_all'
  ) then
    create policy auth_all on public.sugestoes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public._iex_migrations (name, applied_at)
select '0116_sugestoes_ia.sql', now()
where not exists (select 1 from public._iex_migrations where name = '0116_sugestoes_ia.sql');

commit;
```

- [ ] **Step 2: Escrever o script de validação**

Create `scripts/validate-migration-0116.mjs`:

```js
// Valida a migration 0116: tabela sugestoes, colunas, índice único e RLS.
// Uso: node scripts/validate-migration-0116.mjs
import { getClient, loadEnv } from './lib-db.mjs'

const client = await getClient(loadEnv())
let ok = 0, fail = 0
const check = (nome, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  cond ? ok++ : fail++
}

const cols = await client.query(
  `select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'sugestoes'`,
)
const nomes = cols.rows.map((r) => r.column_name)
const esperadas = [
  'id', 'proposta_id', 'disciplina_id', 'disciplina_nome',
  'valor_unitario_sugerido', 'valor_total_sugerido', 'fatores_considerados',
  'justificativa', 'confianca', 'base_recente_qtd', 'base_antiga_qtd',
  'base_antiga', 'fonte', 'usuario_id', 'created_at',
]
for (const c of esperadas) check(`coluna ${c}`, nomes.includes(c))

const idx = await client.query(
  `select indexname from pg_indexes where schemaname = 'public' and tablename = 'sugestoes'`,
)
check('índice único (proposta, disciplina)', idx.rows.some((r) => r.indexname === 'uq_sugestoes_proposta_disciplina'))

const rls = await client.query(
  `select relrowsecurity from pg_class where oid = 'public.sugestoes'::regclass`,
)
check('RLS habilitado', rls.rows[0]?.relrowsecurity === true)

const pol = await client.query(
  `select policyname from pg_policies where schemaname = 'public' and tablename = 'sugestoes'`,
)
check('policy auth_all', pol.rows.some((r) => r.policyname === 'auth_all'))

const mig = await client.query(
  `select 1 from public._iex_migrations where name = '0116_sugestoes_ia.sql'`,
)
check('registrada em _iex_migrations', mig.rowCount === 1)

await client.end()
console.log(`\n${ok} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)
```

`getClient(env)` devolve um `pg.Client` já conectado (detecta a região do pooler sozinho) e exige `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD` em `.env.local`.

- [ ] **Step 3: Rodar a validação e confirmar que FALHA**

```bash
node scripts/validate-migration-0116.mjs
```

Esperado: todas as checagens com `✗` (tabela ainda não existe), exit 1.

- [ ] **Step 4: Aplicar a migration no Supabase**

```bash
node --input-type=module -e "import{getClient,loadEnv}from'./scripts/lib-db.mjs';import{readFileSync}from'node:fs';const c=await getClient(loadEnv());await c.query(readFileSync('supabase/migrations/0116_sugestoes_ia.sql','utf8'));await c.end();console.log('aplicada')"
```

O session pooler (porta 5432) aceita DDL e múltiplas instruções, então o arquivo inteiro roda numa chamada. Precedente: commit `e6c260d` ("fix: aplicar migrations de propostas no Supabase").

- [ ] **Step 5: Rodar a validação e confirmar que PASSA**

```bash
node scripts/validate-migration-0116.mjs
```

Esperado: todas as linhas com `✓`, `0 falhas`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0116_sugestoes_ia.sql scripts/validate-migration-0116.mjs
git commit -m "feat(ia): tabela sugestoes para persistir e medir o copiloto (PRD 14.2)"
```

---

### Task 2: Comparáveis por disciplina e janela recente/antiga

Hoje `buscarComparaveis` lê só `propostas` (total) e corta em 12 meses. O PRD pede comparação **por disciplina** e uso de dados antigos como **referência secundária declarada**.

**Files:**
- Modify: `lib/copiloto/analise.ts` (tipos + `resumirComparaveis`)
- Modify: `lib/copiloto/analise.test.ts`
- Modify: `lib/actions/copiloto.ts:25-43` (`buscarComparaveis`)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `interface PropostaComparavel { area: number; valorFinal: number; valorSugerido: number; recente: boolean }`
  - `interface ItemComparavel { disciplinaNome: string; area: number; valorFinal: number; valorSugerido: number; recente: boolean }`
  - `interface ResumoDisciplina { nome: string; quantidade: number; quantidadeRecente: number; medianaReaisM2: number | null; baseAntiga: boolean }`
  - `interface ResumoComparaveis { quantidade: number; quantidadeRecente: number; medianaReaisM2: number | null; baseAntiga: boolean; porDisciplina: ResumoDisciplina[] }`
  - `function resumirComparaveis(propostas: PropostaComparavel[], itens: ItemComparavel[]): ResumoComparaveis`
  - Tasks 3–8 consomem esses nomes exatos.

- [ ] **Step 1: Escrever os testes que falham**

Substitua o bloco `describe("resumirComparaveis", …)` em `lib/copiloto/analise.test.ts` (linhas 20–46) por:

```ts
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
```

Atualize o import no topo do arquivo de teste para incluir `type ItemComparavel`.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: FAIL — `resumirComparaveis` recebe 1 argumento e devolve `{ quantidade, medianaReaisM2 }`; `ItemComparavel` não existe.

- [ ] **Step 3: Implementar os novos tipos e o resumo**

Em `lib/copiloto/analise.ts`, substitua o bloco `PropostaComparavel` / `ResumoComparaveis` / `resumirComparaveis` (linhas 18–53) por:

```ts
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
```

Se `resumirGrupo` retornar `baseAntiga: false` para lista vazia, o teste do resumo vazio passa — confira que `entradas.length > 0` está na condição.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: PASS no bloco `resumirComparaveis`. Os blocos `analiseHeuristica` e `normalizarResultadoIA` vão falhar por tipo (o resumo mudou de forma) — corrija os literais desses testes adicionando `quantidadeRecente`, `baseAntiga: false` e `porDisciplina: []` aos objetos de resumo usados como fixture. Rode de novo até tudo verde.

- [ ] **Step 5: Atualizar a busca no servidor**

Em `lib/actions/copiloto.ts`, substitua `buscarComparaveis` (linhas 25–43) por:

```ts
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
```

E, em `analisarPrecificacao` (linhas 62–63), troque:

```ts
  const { propostas, itens } = await buscarComparaveis(input.tipo)
  const resumo = resumirComparaveis(propostas, itens)
```

Ajuste o import no topo para incluir `type ItemComparavel`.

- [ ] **Step 6: Validar tipos e build**

```bash
pnpm lint && npx tsc --noEmit
```

Esperado: 0 erros. Se `analiseHeuristica` ainda não usa os campos novos, tudo bem — ela só passa a usá-los na Task 3.

- [ ] **Step 7: Commit**

```bash
git add lib/copiloto/analise.ts lib/copiloto/analise.test.ts lib/actions/copiloto.ts
git commit -m "feat(ia): comparáveis por disciplina e janela recente/antiga (PRD 006)"
```

---

### Task 3: Sugestão de valor unitário por disciplina

Requisito central do PRD 006 e da Jornada 6 (passo 6): "IA sugere valor unitário por m² por disciplina". Hoje só existe faixa do total.

**Files:**
- Modify: `lib/copiloto/analise.ts`
- Modify: `lib/copiloto/analise.test.ts`
- Modify: `lib/actions/copiloto.ts` (SYSTEM_PROMPT)

**Interfaces:**
- Consumes: `ResumoComparaveis`, `ResumoDisciplina` (Task 2).
- Produces:
  - `interface SugestaoDisciplina { nome: string; valorUnitarioM2: number; valorTotal: number; justificativa: string; baseAntiga: boolean }`
  - `CopilotoInput.disciplinas` passa a ser `{ id: string; nome: string; sugerido: number }[]` (ganha `id`, necessário na Task 7)
  - `CopilotoResultado.sugestoesDisciplina: SugestaoDisciplina[]`
  - Tasks 6, 7 e 8 consomem esses nomes.

- [ ] **Step 1: Escrever os testes que falham**

Adicione em `lib/copiloto/analise.test.ts`:

```ts
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
```

Atualize `baseInput` no topo do arquivo para a nova forma de `disciplinas`:

```ts
  disciplinas: [{ id: "d1", nome: "Elétrica", sugerido: 100000 }],
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: FAIL — `sugestoesDisciplina` não existe em `CopilotoResultado`.

- [ ] **Step 3: Implementar**

Em `lib/copiloto/analise.ts`, ajuste `CopilotoInput.disciplinas` e adicione o tipo e o cálculo:

```ts
export interface CopilotoDisciplinaInput {
  id: string
  nome: string
  sugerido: number
}

export interface SugestaoDisciplina {
  nome: string
  valorUnitarioM2: number
  valorTotal: number
  justificativa: string
  baseAntiga: boolean
}
```

Em `CopilotoInput`, troque `disciplinas: { nome: string; sugerido: number }[]` por `disciplinas: CopilotoDisciplinaInput[]`.
Em `CopilotoResultado`, adicione `sugestoesDisciplina: SugestaoDisciplina[]`.

Adicione a função:

```ts
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
```

Em `analiseHeuristica`, calcule `const sugestoesDisciplina = sugerirPorDisciplina(input, resumo)` e inclua no retorno. No early-return de `area <= 0`, retorne `sugestoesDisciplina: []`.

Em `normalizarResultadoIA`, adicione o saneamento e devolva o campo:

```ts
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
```

E inclua `sugestoesDisciplina` no objeto retornado.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: PASS. O teste "retorna estrutura segura para entrada inválida" precisa ganhar `sugestoesDisciplina: []` no literal esperado — ajuste.

- [ ] **Step 5: Atualizar o prompt do sistema**

Em `lib/actions/copiloto.ts`, substitua as linhas do `SYSTEM_PROMPT` que descrevem o JSON por:

```ts
  "Responda APENAS um JSON com esta forma exata:",
  '{"confianca": number (0-100), "mensagens": [{"tone": "info"|"positive"|"caution", "text": string}], "sugestoesDisciplina": [{"nome": string, "valorUnitarioM2": number, "valorTotal": number, "justificativa": string}], "faixaSugerida": {"min": number, "max": number, "racional": string} | null}',
  "Use 2 a 4 mensagens curtas. Em 'sugestoesDisciplina', use APENAS os nomes de disciplina fornecidos e apenas quando houver histórico comparável — nunca invente valor sem base. 'faixaSugerida' é opcional (use null se não houver base histórica). Não inclua nenhum texto fora do JSON.",
```

Em `montarPromptUsuario`, adicione ao array de blocos, antes do `Histórico`:

```ts
    `Mediana histórica por disciplina (R$/m², vazio = sem histórico):\n${
      resumo.porDisciplina.length
        ? resumo.porDisciplina
            .map((p) => `- ${p.nome}: ${p.medianaReaisM2 ? fmtBRL(p.medianaReaisM2) : "sem histórico"}${p.baseAntiga ? " (dados com mais de 12 meses)" : ""} · ${p.quantidade} amostra(s)`)
            .join("\n")
        : "- nenhuma"
    }`,
```

E ajuste a linha de disciplinas para `input.disciplinas.map((d) => \`- ${d.nome}: ${fmtBRL(d.sugerido)}\`)` (a forma continua válida com o campo `id` novo).

- [ ] **Step 6: Corrigir a chamada no wizard**

Em `app/propostas/nova/page.tsx:824`, `disciplinas` precisa passar o `id`:

```ts
        disciplinas: itens.map((i) => ({ id: i.id, nome: i.disciplina, sugerido: i.sugerido })),
```

- [ ] **Step 7: Validar**

```bash
pnpm lint && npx tsc --noEmit && pnpm test
```

Esperado: 0 erros de lint/tipo, todos os testes verdes.

- [ ] **Step 8: Commit**

```bash
git add lib/copiloto/analise.ts lib/copiloto/analise.test.ts lib/actions/copiloto.ts app/propostas/nova/page.tsx
git commit -m "feat(ia): sugestão de valor unitário por disciplina (PRD 006)"
```

---

### Task 4: Perguntas complementares

PRD 006: "fazer perguntas complementares"; Jornada 6 passo 8: "IA faz perguntas se faltar informação crítica".

**Files:**
- Modify: `lib/copiloto/analise.ts`
- Modify: `lib/copiloto/analise.test.ts`
- Modify: `lib/actions/copiloto.ts` (SYSTEM_PROMPT)

**Interfaces:**
- Consumes: `CopilotoInput`, `CopilotoResultado` (Tasks 2–3).
- Produces: `CopilotoResultado.perguntas: string[]` (máx. 3). Task 6 renderiza.

- [ ] **Step 1: Escrever os testes que falham**

Adicione em `lib/copiloto/analise.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: FAIL — `perguntas` não existe em `CopilotoResultado`.

- [ ] **Step 3: Implementar**

Em `lib/copiloto/analise.ts`, adicione `perguntas: string[]` a `CopilotoResultado` e a função:

```ts
const MAX_PERGUNTAS = 3

// Perguntas objetivas quando falta informação crítica para precificar
// (PRD 006 / Jornada 6 passo 8). O copiloto pergunta, não preenche.
export function montarPerguntas(input: CopilotoInput, resumo: ResumoComparaveis): string[] {
  const perguntas: string[] = []
  if (input.area <= 0) perguntas.push("Qual é a área do empreendimento em m²? Sem ela não há base de cálculo.")
  if (!input.padrao) perguntas.push("Qual é o padrão de acabamento previsto? Ele muda a referência de R$/m².")
  if (!input.fase) perguntas.push("Em que fase o projeto está? Anteprojeto e executivo têm esforços distintos.")
  if (input.pulouComplexidade) perguntas.push("As variáveis de complexidade foram avaliadas? A etapa foi pulada e o multiplicador ficou em 1,00×.")
  if (resumo.baseAntiga) perguntas.push("Não há proposta comparável dos últimos 12 meses. Existe alguma referência recente fora do sistema?")
  return perguntas.slice(0, MAX_PERGUNTAS)
}
```

Em `analiseHeuristica`, calcule `const perguntas = montarPerguntas(input, resumo)` e inclua nos dois retornos (inclusive no early-return de `area <= 0`).

Em `normalizarResultadoIA`, adicione:

```ts
  const perguntas = Array.isArray(obj.perguntas)
    ? (obj.perguntas as unknown[])
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter((p) => p.length > 0)
        .slice(0, MAX_PERGUNTAS)
    : []
```

E inclua `perguntas` no retorno.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: PASS. Ajuste o literal do teste "retorna estrutura segura para entrada inválida" adicionando `perguntas: []`.

- [ ] **Step 5: Atualizar o prompt do sistema**

Em `lib/actions/copiloto.ts`, inclua `perguntas` no schema descrito no `SYSTEM_PROMPT`:

```ts
  '{"confianca": number (0-100), "mensagens": [{"tone": "info"|"positive"|"caution", "text": string}], "perguntas": [string], "sugestoesDisciplina": [{"nome": string, "valorUnitarioM2": number, "valorTotal": number, "justificativa": string}], "faixaSugerida": {"min": number, "max": number, "racional": string} | null}',
```

e acrescente à última linha do prompt: `"Em 'perguntas', faça no máximo 3 perguntas objetivas apenas quando faltar informação crítica para precificar; array vazio se não faltar nada."`

- [ ] **Step 6: Validar e commitar**

```bash
pnpm lint && npx tsc --noEmit && pnpm test
```

```bash
git add lib/copiloto/analise.ts lib/copiloto/analise.test.ts lib/actions/copiloto.ts
git commit -m "feat(ia): perguntas complementares quando falta informação crítica (PRD 006)"
```

---

### Task 5: Alimentar o prompt com justificativas anteriores

PRD 006: "aprender com justificativas"; Jornada 6 passo 5: "IA consulta comentários e justificativas anteriores". Sem RAG — apenas as justificativas já registradas em `ajustes_preco` do mesmo tipo de empreendimento entram no prompt.

**Files:**
- Modify: `lib/actions/copiloto.ts`
- Modify: `lib/copiloto/analise.ts` (`montarPromptUsuario`)
- Modify: `lib/copiloto/analise.test.ts`

**Interfaces:**
- Consumes: `CopilotoInput`, `ResumoComparaveis` (Tasks 2–4).
- Produces: `montarPromptUsuario(input, resumo, justificativas: JustificativaAnterior[])` com `interface JustificativaAnterior { disciplinaNome: string; variacaoPct: number; texto: string }`.

- [ ] **Step 1: Escrever o teste que falha**

Adicione em `lib/copiloto/analise.test.ts`:

```ts
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
})
```

Importe `montarPromptUsuario` e `type JustificativaAnterior` no topo do arquivo de teste.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: FAIL — `montarPromptUsuario` aceita 2 argumentos.

- [ ] **Step 3: Implementar**

Em `lib/copiloto/analise.ts`, adicione o tipo e o terceiro parâmetro:

```ts
export interface JustificativaAnterior {
  disciplinaNome: string
  variacaoPct: number
  texto: string
}
```

E, em `montarPromptUsuario`, acrescente o parâmetro e o bloco final:

```ts
export function montarPromptUsuario(
  input: CopilotoInput,
  resumo: ResumoComparaveis,
  justificativas: JustificativaAnterior[],
): string {
  // … blocos existentes …
  const aprendizado = justificativas.length
    ? justificativas
        .map((j) => `- ${j.disciplinaNome} (${j.variacaoPct.toFixed(1)}%): ${j.texto}`)
        .join("\n")
    : "Sem justificativas de ajuste registradas para este tipo de empreendimento."
  return [
    // … blocos existentes …
    `Justificativas de ajuste registradas em propostas anteriores do mesmo tipo:\n${aprendizado}`,
  ].join("\n\n")
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
pnpm test lib/copiloto/analise.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Buscar as justificativas na server action**

Em `lib/actions/copiloto.ts`, adicione:

```ts
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
```

Em `analisarPrecificacao`, busque em paralelo com os comparáveis e passe adiante:

```ts
  const [comparaveis, justificativas] = await Promise.all([
    buscarComparaveis(input.tipo),
    buscarJustificativas(input.tipo),
  ])
  const resumo = resumirComparaveis(comparaveis.propostas, comparaveis.itens)
```

e na chamada da OpenAI: `content: montarPromptUsuario(input, resumo, justificativas)`.

Adicione `type JustificativaAnterior` ao import de `@/lib/copiloto/analise`.

- [ ] **Step 6: Validar e commitar**

```bash
pnpm lint && npx tsc --noEmit && pnpm test
```

```bash
git add lib/copiloto/analise.ts lib/copiloto/analise.test.ts lib/actions/copiloto.ts
git commit -m "feat(ia): prompt considera justificativas de ajuste anteriores (PRD 006)"
```

---

### Task 6: UI — sugestões por disciplina, perguntas e aviso de base antiga

**Divergência declarada do mock contract:** o painel do copiloto passa a exibir uma tabela de sugestões por disciplina e um bloco de perguntas. É uma **adição** dentro do painel já existente na etapa Precificação; nenhuma tela é removida e o painel continua discreto (sem chat, sem dominar a interface). Registrar em `docs/12-execution-roadmap.md` na Task 9.

**Files:**
- Modify: `components/ai-copilot-panel.tsx`
- Modify: `app/propostas/nova/page.tsx` (bloco `step === 4`, linhas ~1467–1490)

**Interfaces:**
- Consumes: `CopilotoResultado` com `sugestoesDisciplina`, `perguntas`, `comparaveis.baseAntiga` (Tasks 2–4).
- Produces: `AICopilotPanel` aceita as props novas `sugestoes?: SugestaoDisciplinaView[]` e `perguntas?: string[]`, com `interface SugestaoDisciplinaView { nome: string; valorUnitarioM2: number; valorTotal: number; justificativa: string; baseAntiga: boolean }`.

- [ ] **Step 1: Estender o painel**

Em `components/ai-copilot-panel.tsx`, adicione antes de `AICopilotPanel`:

```tsx
export interface SugestaoDisciplinaView {
  nome: string
  valorUnitarioM2: number
  valorTotal: number
  justificativa: string
  baseAntiga: boolean
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })

// Sugestões por disciplina: exibição apenas. Nenhum valor é aplicado —
// o usuário digita o valor final na etapa Ajustes (rastreabilidade > automação).
function SugestoesDisciplina({ sugestoes }: { sugestoes: SugestaoDisciplinaView[] }) {
  if (!sugestoes.length) return null
  return (
    <div className="border-t border-border px-4 py-3">
      <p className="mb-2 text-xs font-medium text-foreground">Referência por disciplina</p>
      <ul className="space-y-2">
        {sugestoes.map((s) => (
          <li key={s.nome} className="min-w-0 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{s.nome}</span>{" "}
            <span className="tabular-nums">{fmtBRL(s.valorUnitarioM2)}/m² · {fmtBRL(s.valorTotal)}</span>
            {s.baseAntiga && (
              <Badge variant="outline" className="ml-1.5 gap-1 align-middle">
                <Info className="h-3 w-3" aria-hidden />
                Base com mais de 12 meses
              </Badge>
            )}
            <span className="block break-words">{s.justificativa}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Perguntas({ perguntas }: { perguntas: string[] }) {
  if (!perguntas.length) return null
  return (
    <div className="border-t border-border px-4 py-3">
      <p className="mb-2 text-xs font-medium text-foreground">Perguntas do copiloto</p>
      <ul className="space-y-1.5">
        {perguntas.map((p) => (
          <li key={p} className="flex min-w-0 gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 break-words">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Na assinatura de `AICopilotPanel`, adicione `sugestoes` e `perguntas`:

```tsx
export function AICopilotPanel({
  messages,
  confianca,
  fonte,
  comparaveis,
  sugestoes,
  perguntas,
}: {
  messages: CopilotMessage[]
  confianca?: number
  fonte?: CopilotFonte
  comparaveis?: CopilotComparaveis
  sugestoes?: SugestaoDisciplinaView[]
  perguntas?: string[]
}) {
```

E, logo após o bloco `<div className="min-w-0 flex-1 …">{messages.map(…)}</div>`, insira:

```tsx
      {sugestoes && <SugestoesDisciplina sugestoes={sugestoes} />}
      {perguntas && <Perguntas perguntas={perguntas} />}
```

- [ ] **Step 2: Ligar no wizard**

Em `app/propostas/nova/page.tsx`, na chamada de `<AICopilotPanel …>` (linha ~1469), adicione as props:

```tsx
                      <AICopilotPanel
                        messages={copiloto.mensagens}
                        confianca={copiloto.confianca}
                        fonte={copiloto.fonte}
                        comparaveis={copiloto.comparaveis}
                        sugestoes={copiloto.sugestoesDisciplina}
                        perguntas={copiloto.perguntas}
                      />
```

- [ ] **Step 3: Validar tipos e build**

```bash
pnpm lint && npx tsc --noEmit && pnpm build
```

Esperado: 0 erros.

- [ ] **Step 4: Verificar no browser**

Suba o preview e percorra o wizard até a etapa Precificação (`/propostas/nova`), clique em "Analisar com o copiloto" e confirme:
- as sugestões por disciplina aparecem com R$/m² e total;
- as perguntas aparecem quando padrão/fase estão em branco;
- o badge "Base com mais de 12 meses" aparece só quando não há amostra recente;
- **nenhum valor foi escrito** na etapa Ajustes.

- [ ] **Step 5: Commit**

```bash
git add components/ai-copilot-panel.tsx app/propostas/nova/page.tsx
git commit -m "feat(ia): painel exibe sugestões por disciplina e perguntas do copiloto"
```

---

### Task 7: Persistir a sugestão na finalização

A análise roda na etapa 4, quando a proposta ainda não existe. A gravação acontece na finalização, junto de `registrarAjustes`, que é onde `proposta_id` já é conhecido. Análises que nunca viram proposta não são persistidas — decisão consciente, coerente com `sugestoes.proposta_id NOT NULL` (PRD 14.2 lista "proposta" como campo da entidade).

**Files:**
- Create: `lib/db/sugestoes.ts`
- Modify: `app/propostas/nova/page.tsx` (`handleGerarProposta`, ~linha 973; draft, linhas ~480 e ~448)

**Interfaces:**
- Consumes: tabela `public.sugestoes` (Task 1); `CopilotoResultado`, `CopilotoInput` (Tasks 2–4).
- Produces: `registrarSugestoes(propostaId: string, usuarioId: string | null, input: CopilotoInput, resultado: CopilotoResultado): Promise<void>` e `listarSugestoes(propostaId: string)`. Task 8 lê a mesma tabela.

- [ ] **Step 1: Criar o módulo de escrita**

Create `lib/db/sugestoes.ts`:

```ts
import { createClient } from "@/lib/supabase/client"
import type { CopilotoInput, CopilotoResultado } from "@/lib/copiloto/analise"

// Persiste o que o copiloto sugeriu, por disciplina (PRD 14.2). É a base da
// métrica de aderência (PRD 16.4): valor_total_sugerido × proposta_itens.valor_final.
// Upsert por (proposta, disciplina): re-finalizar a proposta atualiza a linha.
export async function registrarSugestoes(
  propostaId: string,
  usuarioId: string | null,
  input: CopilotoInput,
  resultado: CopilotoResultado,
): Promise<void> {
  if (!resultado.sugestoesDisciplina.length) return
  const supabase = createClient()
  const idPorNome = new Map(input.disciplinas.map((d) => [d.nome, d.id]))
  const rows = resultado.sugestoesDisciplina.map((s) => {
    const hist = resultado.comparaveis.porDisciplina.find((p) => p.nome === s.nome)
    return {
      proposta_id: propostaId,
      disciplina_id: idPorNome.get(s.nome) ?? null,
      disciplina_nome: s.nome,
      valor_unitario_sugerido: s.valorUnitarioM2,
      valor_total_sugerido: s.valorTotal,
      fatores_considerados: {
        tipo: input.tipo,
        area: input.area,
        padrao: input.padrao ?? null,
        fase: input.fase ?? null,
        urgencia: input.urgencia,
        multiplicadorComplexidade: input.multiplicadorComplexidade,
        pulouComplexidade: input.pulouComplexidade,
      },
      justificativa: s.justificativa || null,
      confianca: resultado.confianca,
      base_recente_qtd: hist?.quantidadeRecente ?? 0,
      base_antiga_qtd: Math.max(0, (hist?.quantidade ?? 0) - (hist?.quantidadeRecente ?? 0)),
      base_antiga: s.baseAntiga,
      fonte: resultado.fonte,
      usuario_id: usuarioId,
    }
  })
  const { error } = await supabase
    .from("sugestoes")
    .upsert(rows, { onConflict: "proposta_id,disciplina_nome" })
  if (error) throw error
}

export async function listarSugestoes(propostaId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sugestoes")
    .select("disciplina_nome, valor_unitario_sugerido, valor_total_sugerido, justificativa, confianca, base_antiga, fonte, created_at")
    .eq("proposta_id", propostaId)
    .order("disciplina_nome")
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Guardar o input do copiloto no wizard**

Em `app/propostas/nova/page.tsx`, ao lado de `const [copiloto, setCopiloto] = useState<CopilotoResultado | null>(null)` (linha ~807), adicione:

```ts
  // Guarda o input exato da última análise, para persistir junto da sugestão.
  const [copilotoInput, setCopilotoInput] = useState<CopilotoInput | null>(null)
```

Em `handleAnalisarCopiloto`, monte o input numa variável, guarde-o e use-o na chamada:

```ts
      const payload: CopilotoInput = {
        tipo: tipoEmp,
        area,
        padrao,
        fase,
        urgencia,
        multiplicadorComplexidade: complexMultiplier,
        pulouComplexidade: pularComplexidade,
        disciplinas: itens.map((i) => ({ id: i.id, nome: i.disciplina, sugerido: i.sugerido })),
        totalSugerido,
      }
      const r = await analisarPrecificacao(payload)
      setCopilotoInput(payload)
      setCopiloto(r)
```

No `catch`, adicione `setCopilotoInput(null)`. Importe `type CopilotoInput` de `@/lib/copiloto/analise`.

- [ ] **Step 3: Persistir na finalização**

Em `handleGerarProposta`, logo depois do bloco `await registrarAjustes(…).catch(() => {})` (linha ~976), adicione:

```ts
      // Sugestão do copiloto: auditoria complementar, não altera a versão.
      if (copiloto && copilotoInput) {
        await registrarSugestoes(id, responsavel.id, copilotoInput, copiloto).catch(() => {})
      }
```

Importe `registrarSugestoes` de `@/lib/db/sugestoes`.

- [ ] **Step 4: Incluir no draft**

No objeto `draft` (linha ~480) e no restore (linha ~448), adicione `copiloto` e `copilotoInput`, para que a análise sobreviva a um reload no meio do wizard:

```ts
  // no draft:
      copiloto, copilotoInput,
  // no restore:
      setCopiloto(draft.copiloto ?? null)
      setCopilotoInput(draft.copilotoInput ?? null)
```

Inclua ambos nos arrays de dependência do `useMemo`/`useEffect` do draft (linhas ~480 e ~494), seguindo o padrão dos demais campos.

- [ ] **Step 5: Validar**

```bash
pnpm lint && npx tsc --noEmit && pnpm build
```

- [ ] **Step 6: Verificar fim a fim**

Crie uma proposta completa passando pelo copiloto, finalize, e confirme no banco:

```bash
node --input-type=module -e "import{getClient,loadEnv}from'./scripts/lib-db.mjs';const c=await getClient(loadEnv());const r=await c.query('select disciplina_nome, valor_total_sugerido, fonte, base_antiga from public.sugestoes order by created_at desc limit 10');console.table(r.rows);await c.end()"
```

Esperado: uma linha por disciplina sugerida, com `fonte` = `ia` ou `heuristica`.

- [ ] **Step 7: Commit**

```bash
git add lib/db/sugestoes.ts app/propostas/nova/page.tsx
git commit -m "feat(ia): persiste sugestões do copiloto na finalização da proposta (PRD 14.2)"
```

---

### Task 8: Métricas de aderência (PRD 16.4)

Regra crítica do PRD: "Aderência da IA será medida pela manutenção dos valores sugeridos, e não pela ausência de edição textual da proposta."

**Files:**
- Create: `lib/copiloto/metricas.ts`
- Create: `lib/copiloto/metricas.test.ts`
- Modify: `lib/db/sugestoes.ts` (leitura agregada)
- Create: `components/metricas-ia-card.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: tabela `sugestoes` (Task 1), `proposta_itens` (existente).
- Produces:
  - `interface LinhaAderencia { disciplinaNome: string; valorSugeridoIA: number; valorFinal: number; confianca: number; baseAntiga: boolean; temJustificativa: boolean; fonte: "ia" | "heuristica" }`
  - `interface MetricasIA { amostra: number; aderenciaPct: number; alteradosPct: number; variacaoMediaPct: number; justificativasPct: number; baixaConfiancaPct: number; baseAntigaPct: number }`
  - `function computeMetricasIA(linhas: LinhaAderencia[]): MetricasIA`
  - `async function getMetricasIA(): Promise<MetricasIA>`

- [ ] **Step 1: Escrever os testes que falham**

Create `lib/copiloto/metricas.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { computeMetricasIA, type LinhaAderencia } from "./metricas"

const linha = (over: Partial<LinhaAderencia> = {}): LinhaAderencia => ({
  disciplinaNome: "Elétrica",
  valorSugeridoIA: 100000,
  valorFinal: 100000,
  confianca: 80,
  baseAntiga: false,
  temJustificativa: false,
  fonte: "ia",
  ...over,
})

describe("computeMetricasIA", () => {
  it("retorna zeros para amostra vazia", () => {
    expect(computeMetricasIA([])).toEqual({
      amostra: 0,
      aderenciaPct: 0,
      alteradosPct: 0,
      variacaoMediaPct: 0,
      justificativasPct: 0,
      baixaConfiancaPct: 0,
      baseAntigaPct: 0,
    })
  })

  it("conta como aderente uma variação dentro de 2%", () => {
    const m = computeMetricasIA([linha({ valorFinal: 101000 })]) // +1%
    expect(m.aderenciaPct).toBe(100)
    expect(m.alteradosPct).toBe(0)
  })

  it("conta como alterado acima de 2% e mede a variação média em módulo", () => {
    const m = computeMetricasIA([linha({ valorFinal: 90000 }), linha({ valorFinal: 110000 })])
    expect(m.aderenciaPct).toBe(0)
    expect(m.alteradosPct).toBe(100)
    expect(m.variacaoMediaPct).toBe(10)
  })

  it("mede justificativas, baixa confiança e uso de base antiga", () => {
    const m = computeMetricasIA([
      linha({ temJustificativa: true, confianca: 30, baseAntiga: true }),
      linha({ temJustificativa: false, confianca: 90, baseAntiga: false }),
    ])
    expect(m.justificativasPct).toBe(50)
    expect(m.baixaConfiancaPct).toBe(50)
    expect(m.baseAntigaPct).toBe(50)
  })

  it("ignora linhas sem valor sugerido (evita divisão por zero)", () => {
    const m = computeMetricasIA([linha({ valorSugeridoIA: 0, valorFinal: 5000 })])
    expect(m.amostra).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/copiloto/metricas.test.ts
```

Esperado: FAIL — módulo `./metricas` não existe.

- [ ] **Step 3: Implementar o cálculo puro**

Create `lib/copiloto/metricas.ts`:

```ts
// Métricas de aderência ao copiloto (PRD 16.4). Lógica pura, sem I/O.
// Regra crítica do PRD: aderência = manutenção do VALOR sugerido, não ausência
// de edição de texto.

export interface LinhaAderencia {
  disciplinaNome: string
  valorSugeridoIA: number
  valorFinal: number
  confianca: number
  baseAntiga: boolean
  temJustificativa: boolean
  fonte: "ia" | "heuristica"
}

export interface MetricasIA {
  amostra: number
  aderenciaPct: number
  alteradosPct: number
  variacaoMediaPct: number
  justificativasPct: number
  baixaConfiancaPct: number
  baseAntigaPct: number
}

// Tolerância de aderência: até 2% de diferença conta como "manteve o valor".
const TOLERANCIA_PCT = 2
const CONFIANCA_BAIXA = 50

const ZERO: MetricasIA = {
  amostra: 0,
  aderenciaPct: 0,
  alteradosPct: 0,
  variacaoMediaPct: 0,
  justificativasPct: 0,
  baixaConfiancaPct: 0,
  baseAntigaPct: 0,
}

export function computeMetricasIA(linhas: LinhaAderencia[]): MetricasIA {
  const validas = linhas.filter((l) => l.valorSugeridoIA > 0)
  if (validas.length === 0) return ZERO
  const n = validas.length
  const pct = (qtd: number) => Math.round((qtd / n) * 100)
  const variacoes = validas.map((l) => Math.abs((l.valorFinal - l.valorSugeridoIA) / l.valorSugeridoIA) * 100)
  const aderentes = variacoes.filter((v) => v <= TOLERANCIA_PCT).length
  return {
    amostra: n,
    aderenciaPct: pct(aderentes),
    alteradosPct: pct(n - aderentes),
    variacaoMediaPct: Math.round((variacoes.reduce((a, b) => a + b, 0) / n) * 10) / 10,
    justificativasPct: pct(validas.filter((l) => l.temJustificativa).length),
    baixaConfiancaPct: pct(validas.filter((l) => l.confianca < CONFIANCA_BAIXA).length),
    baseAntigaPct: pct(validas.filter((l) => l.baseAntiga).length),
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/copiloto/metricas.test.ts
```

Esperado: PASS (5 testes).

- [ ] **Step 5: Ler os dados no banco**

Adicione ao final de `lib/db/sugestoes.ts`:

```ts
import { computeMetricasIA, type LinhaAderencia, type MetricasIA } from "@/lib/copiloto/metricas"

// Cruza a sugestão da IA com o valor efetivamente praticado no item da proposta.
export async function getMetricasIA(): Promise<MetricasIA> {
  const supabase = createClient()
  const [{ data: sugs }, { data: itens }] = await Promise.all([
    supabase.from("sugestoes").select("proposta_id, disciplina_nome, valor_total_sugerido, confianca, base_antiga, fonte"),
    supabase.from("proposta_itens").select("proposta_id, disciplina_nome, valor_final, justificativa"),
  ])
  if (!sugs || !itens) return computeMetricasIA([])
  const chave = (p: unknown, d: unknown) => `${String(p)}|${String(d)}`
  const porChave = new Map(
    (itens as Record<string, unknown>[]).map((i) => [chave(i.proposta_id, i.disciplina_nome), i]),
  )
  const linhas: LinhaAderencia[] = (sugs as Record<string, unknown>[]).flatMap((s) => {
    const item = porChave.get(chave(s.proposta_id, s.disciplina_nome))
    if (!item) return []
    return [{
      disciplinaNome: String(s.disciplina_nome),
      valorSugeridoIA: Number(s.valor_total_sugerido) || 0,
      valorFinal: Number(item.valor_final) || 0,
      confianca: Number(s.confianca) || 0,
      baseAntiga: Boolean(s.base_antiga),
      temJustificativa: String(item.justificativa ?? "").trim().length > 0,
      fonte: s.fonte === "ia" ? "ia" : "heuristica",
    }]
  })
  return computeMetricasIA(linhas)
}
```

`proposta_itens.justificativa` existe e é preenchida pela função de finalização em `supabase/migrations/0115_padronizacao_propostas.sql:326` — a query acima está correta como escrita.

- [ ] **Step 6: Card no dashboard**

**Divergência declarada do mock contract:** o dashboard ganha um card "Aderência ao copiloto". É adição; nenhum card existente é removido ou reposicionado. Registrar na Task 9.

Create `components/metricas-ia-card.tsx`:

```tsx
"use client"

import { Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { MetricasIA } from "@/lib/copiloto/metricas"

export function MetricasIACard({ metricas }: { metricas: MetricasIA }) {
  if (metricas.amostra === 0) {
    return (
      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Aderência ao copiloto</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Ainda não há propostas finalizadas com sugestão do copiloto. A métrica aparece assim que a primeira for gerada.
        </p>
      </Card>
    )
  }
  const linhas: [string, string][] = [
    ["Aderência aos valores sugeridos", `${metricas.aderenciaPct}%`],
    ["Valores alterados", `${metricas.alteradosPct}%`],
    ["Variação média", `${metricas.variacaoMediaPct}%`],
    ["Alterações justificadas", `${metricas.justificativasPct}%`],
    ["Sugestões de baixa confiança", `${metricas.baixaConfiancaPct}%`],
    ["Baseadas em dados antigos", `${metricas.baseAntigaPct}%`],
  ]
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Aderência ao copiloto</p>
        </div>
        <span className="text-xs text-muted-foreground">{metricas.amostra} sugestão(ões)</span>
      </div>
      <dl className="space-y-1.5">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="min-w-0 text-muted-foreground">{rotulo}</dt>
            <dd className="font-medium tabular-nums text-foreground">{valor}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
```

- [ ] **Step 7: Montar no dashboard**

Em `app/page.tsx`, adicione o estado e o carregamento seguindo o padrão já usado para `getDashboard` (o dashboard é client-side; replique o `useEffect` existente), e renderize `<MetricasIACard metricas={metricasIA} />` ao final da grade de cards. Se o carregamento falhar, mantenha o card vazio — a métrica nunca pode derrubar o dashboard:

```tsx
  const [metricasIA, setMetricasIA] = useState<MetricasIA>({
    amostra: 0, aderenciaPct: 0, alteradosPct: 0, variacaoMediaPct: 0,
    justificativasPct: 0, baixaConfiancaPct: 0, baseAntigaPct: 0,
  })
  useEffect(() => {
    getMetricasIA().then(setMetricasIA).catch(() => {})
  }, [])
```

- [ ] **Step 8: Validar**

```bash
pnpm lint && npx tsc --noEmit && pnpm test && pnpm build
```

- [ ] **Step 9: Verificar no browser**

Abra o dashboard e confirme que o card aparece — com o estado vazio se ainda não houver sugestões persistidas, e com os percentuais depois de finalizar uma proposta que passou pelo copiloto.

- [ ] **Step 10: Commit**

```bash
git add lib/copiloto/metricas.ts lib/copiloto/metricas.test.ts lib/db/sugestoes.ts components/metricas-ia-card.tsx app/page.tsx
git commit -m "feat(ia): métricas de aderência ao copiloto no dashboard (PRD 16.4)"
```

---

### Task 9: Documentação e divergências

**Files:**
- Modify: `docs/01-prd.md:27`
- Modify: `docs/12-execution-roadmap.md` (Fase 3)
- Modify: `docs/13-qa-roteiro-onda3.md`
- Modify: `.env.example` (conferir que `OPENAI_API_KEY` e `OPENAI_MODEL` estão documentados)

**Interfaces:**
- Consumes: o estado final das Tasks 1–8.
- Produces: documentação consistente. Nenhum código depende desta task.

- [ ] **Step 1: Corrigir o status no PRD**

Em `docs/01-prd.md`, troque a linha 27:

```markdown
- [x] IA copiloto (PRD 006) — sugestão por disciplina, perguntas, base recente/antiga declarada, persistência em `sugestoes` e métricas de aderência
```

E, na linha 3, remova a nota "está **adiada**", substituindo por: `> A IA/copiloto (PRD 006) foi entregue na Fase 3 — ver docs/12-execution-roadmap.md.`
Na linha 33, troque `Sugestão IA(\`sugestoes\`-adiado)` por `Sugestão IA(\`sugestoes\`)`.

- [ ] **Step 2: Atualizar o roadmap com as divergências**

Em `docs/12-execution-roadmap.md`, na Fase 3, acrescente as entregas desta rodada e a seção de divergências do mock contract (exigência do AGENTS.md):

```markdown
#### Divergências declaradas do mock contract (Fase 3)

- **Painel do copiloto** ganhou lista de sugestões por disciplina e bloco de perguntas.
  *Por quê:* PRD 006 exige sugestão de valor unitário por disciplina e perguntas complementares — o painel de mensagens não comporta isso.
  *O que substitui:* o painel continua discreto, sem chat, dentro da etapa Precificação; nada é aplicado automaticamente.
  *Docs atualizados:* `docs/02-mock-contract.md` (Contrato do Copiloto), este roadmap.
- **Dashboard** ganhou o card "Aderência ao copiloto".
  *Por quê:* PRD 16.4 define métricas da IA e a hipótese 3.4 condiciona automação futura à aderência medida.
  *O que substitui:* adição ao final da grade; nenhum card existente foi removido ou reposicionado.
  *Docs atualizados:* este roadmap.
```

- [ ] **Step 3: Estender o roteiro de QA**

Em `docs/13-qa-roteiro-onda3.md`, adicione ao bloco do copiloto:

```markdown
- [ ] Sugestões por disciplina aparecem com R$/m² e total, e **nenhum** valor é escrito na etapa Ajustes.
- [ ] Perguntas do copiloto aparecem quando padrão/fase estão em branco ou a complexidade foi pulada.
- [ ] Badge "Base com mais de 12 meses" aparece só quando não há comparável recente.
- [ ] Após finalizar a proposta, `select * from public.sugestoes where proposta_id = '<id>'` retorna uma linha por disciplina sugerida.
- [ ] Card "Aderência ao copiloto" no dashboard sai do estado vazio depois dessa finalização.
```

- [ ] **Step 4: Conferir o `.env.example`**

```bash
grep -n "OPENAI" .env.example
```

Se `OPENAI_API_KEY=` e `OPENAI_MODEL=gpt-4o-mini` não estiverem lá, adicione.

- [ ] **Step 5: Validação final completa**

```bash
pnpm lint && npx tsc --noEmit && pnpm test && pnpm build && node scripts/validate-db.mjs
```

Esperado: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add docs/01-prd.md docs/12-execution-roadmap.md docs/13-qa-roteiro-onda3.md .env.example
git commit -m "docs(ia): atualiza PRD, roadmap e QA com o escopo entregue do copiloto"
```

---

## Cobertura do PRD 006

| Requisito | Task |
|---|---|
| Analisar proposta em elaboração | já existia |
| Consultar histórico dos últimos 12 meses | já existia; refinado na 2 |
| Usar dados antigos apenas como referência secundária | 2 |
| Declarar quando usa dados antigos | 2, 6 |
| Sugerir valores unitários por disciplina | 3 |
| Justificar sugestões | 3 |
| Fazer perguntas complementares | 4 |
| Comparar com propostas similares | 2 |
| Registrar comentários | 7 |
| Aprender com justificativas | 5 |
| Avisar quando a amostra recente for insuficiente | 2, 4 |
| Não decidir preço final / não alterar sem confirmação | Global Constraints (mantido) |
| Entidade "Sugestão da IA" (PRD 14.2) | 1, 7 |
| Métricas da IA (PRD 16.4) | 8 |

**Fora deste plano, conscientemente:**
- **RAG sobre a base de conhecimento (PRD 007)** — `docs/01-prd.md:52` coloca "RAG avançado" fora do escopo do MVP. Task 5 entrega o aprendizado possível sem RAG.
- **Etapa própria "Sugestão da IA" no wizard** — a decisão de manter o copiloto dentro da etapa Precificação continua válida e está justificada em `docs/superpowers/specs/2026-06-29-copiloto-precificacao-ia-design.md:94`. Reverter isso renumeraria o wizard inteiro e romperia o contrato de mock por um ganho pequeno.
