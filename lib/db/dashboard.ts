import { listarPropostas } from "./propostas"
import type { Proposta, StatusProposta } from "./types"

// ---------------------------------------------------------------------------
// Tipos locais (candidatos a promoção para lib/db/types.ts — ver resumo).
// ---------------------------------------------------------------------------

export type PeriodoDashboard = "mes" | "trimestre" | "semestre" | "ano"
export type StatusFiltroDashboard = "Todos" | StatusProposta

/**
 * Variação de uma métrica em relação ao período comparável anterior.
 * - `delta === null` => não há base comparável (período anterior sem dados),
 *   a UI deve rotular como "sem base comparável" em vez de fingir 0%.
 * - `positive` indica a direção favorável (todas as métricas atuais: maior = melhor).
 */
export interface TrendValue {
  delta: number | null
  unit: "%" | "p.p."
  positive: boolean
}

export interface DashboardData {
  periodo: PeriodoDashboard
  status: StatusFiltroDashboard
  periodoLabel: string
  /** Intervalo textual do período selecionado (ex.: "01/07/2026 – 15/07/2026"). */
  intervaloLabel: string
  /** Rótulo curto para hints de tendência (ex.: "vs. mês anterior"). */
  comparativoLabel: string
  /** false quando o conjunto filtrado está vazio (estado "sem dados"). */
  temDados: boolean

  criadas: number
  totalEnviadas: number
  totalAprovadas: number
  valorAprovado: number
  ticketMedio: number
  taxaConversao: number

  trends: {
    criadas: TrendValue
    totalEnviadas: TrendValue
    totalAprovadas: TrendValue
    valorAprovado: TrendValue
    ticketMedio: TrendValue
    taxaConversao: TrendValue
  }

  aprovadasPorMes: { mes: string; quantidade: number; valor: number }[]
  conversaoPorOrigem: { origem: string; taxa: number; valor: number }[]
  disciplinasMaisVendidas: { disciplina: string; quantidade: number }[]
  porTipoEmpreendimento: { tipo: string; quantidade: number; valor: number }[]
  clientesTop: { cliente: string; quantidade: number; valor: number }[]
  motivosPerda: { motivo: string; quantidade: number }[]
  funil: { emElaboracao: number; enviadas: number; aprovadas: number; perdidas: number }
  semRetorno: Proposta[]
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

const PERIODO_LABEL: Record<PeriodoDashboard, string> = {
  mes: "Este mês",
  trimestre: "Últimos 3 meses",
  semestre: "Últimos 6 meses",
  ano: "Este ano",
}

const COMPARATIVO_LABEL: Record<PeriodoDashboard, string> = {
  mes: "vs. mês anterior",
  trimestre: "vs. trimestre anterior",
  semestre: "vs. semestre anterior",
  ano: "vs. ano anterior",
}

// ---------------------------------------------------------------------------
// Utilidades de data (datas são "YYYY-MM-DD"; interpretadas como meia-noite local)
// ---------------------------------------------------------------------------

function parseData(s: string): Date {
  return new Date(s + "T00:00:00")
}

function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1, 0, 0, 0, 0)
}

function endOfMonth(y: number, m: number): Date {
  return new Date(y, m + 1, 0, 23, 59, 59, 999)
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function ddmmyyyy(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function ddmm(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
}

interface Janela {
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
}

/** Calcula a janela do período atual e do período comparável anterior. */
function janelaDoPeriodo(periodo: PeriodoDashboard, now: Date): Janela {
  const y = now.getFullYear()
  const m = now.getMonth()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  switch (periodo) {
    case "mes":
      return {
        start: startOfMonth(y, m),
        end,
        prevStart: startOfMonth(y, m - 1),
        prevEnd: endOfMonth(y, m - 1),
      }
    case "trimestre":
      return {
        start: startOfMonth(y, m - 2),
        end,
        prevStart: startOfMonth(y, m - 5),
        prevEnd: endOfMonth(y, m - 3),
      }
    case "semestre":
      return {
        start: startOfMonth(y, m - 5),
        end,
        prevStart: startOfMonth(y, m - 11),
        prevEnd: endOfMonth(y, m - 6),
      }
    case "ano":
      return {
        start: new Date(y, 0, 1, 0, 0, 0, 0),
        end,
        prevStart: new Date(y - 1, 0, 1, 0, 0, 0, 0),
        prevEnd: new Date(y - 1, 11, 31, 23, 59, 59, 999),
      }
  }
}

function noIntervalo(dataStr: string, start: Date, end: Date): boolean {
  const t = parseData(dataStr).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

// ---------------------------------------------------------------------------
// Buckets do gráfico de série temporal (semanal para "mês", mensal caso contrário)
// ---------------------------------------------------------------------------

interface Bucket {
  mes: string
  start: number
  end: number
  quantidade: number
  valor: number
}

function construirBuckets(periodo: PeriodoDashboard, start: Date, end: Date): Bucket[] {
  const buckets: Bucket[] = []

  if (periodo === "mes") {
    // Buckets semanais dentro do mês corrente.
    let cursor = new Date(start)
    while (cursor.getTime() <= end.getTime()) {
      const bStart = new Date(cursor)
      const bEnd = new Date(cursor)
      bEnd.setDate(bEnd.getDate() + 6)
      bEnd.setHours(23, 59, 59, 999)
      buckets.push({ mes: ddmm(bStart), start: bStart.getTime(), end: bEnd.getTime(), quantidade: 0, valor: 0 })
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() + 7)
    }
    return buckets
  }

  // Buckets mensais de start.month até end.month (inclusive).
  let y = start.getFullYear()
  let m = start.getMonth()
  const endY = end.getFullYear()
  const endM = end.getMonth()
  while (y < endY || (y === endY && m <= endM)) {
    buckets.push({
      mes: MESES[m],
      start: startOfMonth(y, m).getTime(),
      end: endOfMonth(y, m).getTime(),
      quantidade: 0,
      valor: 0,
    })
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return buckets
}

// ---------------------------------------------------------------------------
// Núcleo de métricas + tendências
// ---------------------------------------------------------------------------

interface NucleoMetricas {
  criadas: number
  totalEnviadas: number
  totalAprovadas: number
  valorAprovado: number
  ticketMedio: number
  taxaConversao: number
  conversaoComparavel: boolean
}

function filtrarConjunto(
  propostas: Proposta[],
  start: Date,
  end: Date,
  status: StatusFiltroDashboard,
): Proposta[] {
  return propostas.filter(
    (p) =>
      noIntervalo(p.dataCriacao, start, end) &&
      (status === "Todos" || p.status === status),
  )
}

function nucleo(conjunto: Proposta[]): NucleoMetricas {
  const enviadasOuMais = conjunto.filter((p) =>
    p.status === "Enviada" || p.status === "Aprovada" || p.status === "Perdida",
  )
  const aprovadasArr = conjunto.filter((p) => p.status === "Aprovada")
  const valorAprovado = aprovadasArr.reduce((a, p) => a + p.valorFinal, 0)
  const totalAprovadas = aprovadasArr.length
  const totalEnviadas = enviadasOuMais.length
  return {
    criadas: conjunto.length,
    totalEnviadas,
    totalAprovadas,
    valorAprovado,
    ticketMedio: totalAprovadas ? Math.round(valorAprovado / totalAprovadas) : 0,
    taxaConversao: totalEnviadas ? Math.round((totalAprovadas / totalEnviadas) * 100) : 0,
    conversaoComparavel: totalEnviadas > 0,
  }
}

/** Variação percentual. Sem base comparável quando o valor anterior é 0. */
function deltaPct(atual: number, anterior: number): TrendValue {
  if (anterior === 0) return { delta: null, unit: "%", positive: atual >= 0 }
  const d = Math.round(((atual - anterior) / anterior) * 100)
  return { delta: d, unit: "%", positive: d >= 0 }
}

/** Variação em pontos percentuais (para taxas). */
function deltaPP(atual: number, anterior: number, comparavel: boolean): TrendValue {
  if (!comparavel) return { delta: null, unit: "p.p.", positive: atual >= 0 }
  const d = atual - anterior
  return { delta: d, unit: "p.p.", positive: d >= 0 }
}

// ---------------------------------------------------------------------------
// Cálculo principal (puro — recebe as propostas já carregadas)
// ---------------------------------------------------------------------------

export function computeDashboard(
  propostas: Proposta[],
  opts?: { periodo?: PeriodoDashboard; status?: StatusFiltroDashboard; now?: Date },
): DashboardData {
  const periodo = opts?.periodo ?? "mes"
  const status = opts?.status ?? "Todos"
  const now = opts?.now ?? new Date()

  const { start, end, prevStart, prevEnd } = janelaDoPeriodo(periodo, now)

  const conjunto = filtrarConjunto(propostas, start, end, status)
  const conjuntoAnterior = filtrarConjunto(propostas, prevStart, prevEnd, status)

  const atual = nucleo(conjunto)
  const anterior = nucleo(conjuntoAnterior)

  const trends: DashboardData["trends"] = {
    criadas: deltaPct(atual.criadas, anterior.criadas),
    totalEnviadas: deltaPct(atual.totalEnviadas, anterior.totalEnviadas),
    totalAprovadas: deltaPct(atual.totalAprovadas, anterior.totalAprovadas),
    valorAprovado: deltaPct(atual.valorAprovado, anterior.valorAprovado),
    ticketMedio: deltaPct(atual.ticketMedio, anterior.ticketMedio),
    taxaConversao: deltaPP(atual.taxaConversao, anterior.taxaConversao, anterior.conversaoComparavel),
  }

  // Série temporal — aprovadas do conjunto distribuídas nos buckets do período.
  const buckets = construirBuckets(periodo, start, end)
  for (const p of conjunto) {
    if (p.status !== "Aprovada") continue
    const t = parseData(p.dataEnvio || p.dataCriacao).getTime()
    const b = buckets.find((x) => t >= x.start && t <= x.end)
    if (b) {
      b.quantidade += 1
      b.valor += p.valorFinal
    }
  }
  const aprovadasPorMes = buckets.map(({ mes, quantidade, valor }) => ({ mes, quantidade, valor }))

  // Conversão por origem (dentro do conjunto).
  const origemMap = new Map<string, { enviadas: number; aprovadas: number; valor: number }>()
  for (const p of conjunto) {
    if (!(p.status === "Enviada" || p.status === "Aprovada" || p.status === "Perdida")) continue
    const o = p.origem || "—"
    const cur = origemMap.get(o) ?? { enviadas: 0, aprovadas: 0, valor: 0 }
    cur.enviadas += 1
    if (p.status === "Aprovada") {
      cur.aprovadas += 1
      cur.valor += p.valorFinal
    }
    origemMap.set(o, cur)
  }
  const conversaoPorOrigem = Array.from(origemMap.entries())
    .map(([origem, v]) => ({
      origem,
      taxa: v.enviadas ? Math.round((v.aprovadas / v.enviadas) * 100) : 0,
      valor: v.valor,
    }))
    .sort((a, b) => b.taxa - a.taxa)

  // Disciplinas mais vendidas (dentro do conjunto).
  const discMap = new Map<string, number>()
  for (const p of conjunto) {
    for (const d of p.disciplinas) discMap.set(d, (discMap.get(d) ?? 0) + 1)
  }
  const disciplinasMaisVendidas = Array.from(discMap.entries())
    .map(([disciplina, quantidade]) => ({ disciplina, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 6)

  // Por tipo de empreendimento (dentro do conjunto).
  const tipoMap = new Map<string, { quantidade: number; valor: number }>()
  for (const p of conjunto) {
    const t = p.tipo || "—"
    const cur = tipoMap.get(t) ?? { quantidade: 0, valor: 0 }
    cur.quantidade += 1
    cur.valor += p.valorFinal
    tipoMap.set(t, cur)
  }
  const porTipoEmpreendimento = Array.from(tipoMap.entries())
    .map(([tipo, v]) => ({ tipo, quantidade: v.quantidade, valor: v.valor }))
    .sort((a, b) => b.quantidade - a.quantidade)

  // Clientes top (valor aprovado, dentro do conjunto).
  const clienteMap = new Map<string, { quantidade: number; valor: number }>()
  for (const p of conjunto) {
    if (p.status !== "Aprovada") continue
    const c = p.cliente || "—"
    const cur = clienteMap.get(c) ?? { quantidade: 0, valor: 0 }
    cur.quantidade += 1
    cur.valor += p.valorFinal
    clienteMap.set(c, cur)
  }
  const clientesTop = Array.from(clienteMap.entries())
    .map(([cliente, v]) => ({ cliente, quantidade: v.quantidade, valor: v.valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6)

  // Motivos de perda (dentro do conjunto).
  const motivoMap = new Map<string, number>()
  for (const p of conjunto) {
    if (p.status !== "Perdida") continue
    const mtv = p.motivoPerda || "Não informado"
    motivoMap.set(mtv, (motivoMap.get(mtv) ?? 0) + 1)
  }
  const motivosPerda = Array.from(motivoMap.entries())
    .map(([motivo, quantidade]) => ({ motivo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)

  // Funil (dentro do conjunto).
  const funil = {
    emElaboracao: conjunto.filter((p) => p.status === "Em elaboração").length,
    enviadas: conjunto.filter((p) => p.status === "Enviada").length,
    aprovadas: atual.totalAprovadas,
    perdidas: conjunto.filter((p) => p.status === "Perdida").length,
  }

  const semRetorno = conjunto
    .filter((p) => p.status === "Enviada" && p.diasSemRetorno >= 7)
    .sort((a, b) => b.diasSemRetorno - a.diasSemRetorno)

  return {
    periodo,
    status,
    periodoLabel: PERIODO_LABEL[periodo],
    intervaloLabel: `${ddmmyyyy(start)} – ${ddmmyyyy(end)}`,
    comparativoLabel: COMPARATIVO_LABEL[periodo],
    temDados: conjunto.length > 0,
    criadas: atual.criadas,
    totalEnviadas: atual.totalEnviadas,
    totalAprovadas: atual.totalAprovadas,
    valorAprovado: atual.valorAprovado,
    ticketMedio: atual.ticketMedio,
    taxaConversao: atual.taxaConversao,
    trends,
    aprovadasPorMes,
    conversaoPorOrigem,
    disciplinasMaisVendidas,
    porTipoEmpreendimento,
    clientesTop,
    motivosPerda,
    funil,
    semRetorno,
  }
}

/** Busca as propostas e calcula o dashboard (conveniência server/client). */
export async function getDashboard(opts?: {
  periodo?: PeriodoDashboard
  status?: StatusFiltroDashboard
  now?: Date
}): Promise<DashboardData> {
  const propostas = await listarPropostas()
  return computeDashboard(propostas, opts)
}
