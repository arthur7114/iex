import { listarPropostas } from "./propostas"
import type { Proposta } from "./types"

export interface DashboardData {
  criadasNoMes: number
  taxaConversao: number
  valorAprovado: number
  totalEnviadas: number
  totalAprovadas: number
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

export async function getDashboard(): Promise<DashboardData> {
  const propostas = await listarPropostas()
  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  const criadasNoMes = propostas.filter((p) => {
    const d = new Date(p.dataCriacao + "T00:00:00")
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
  }).length

  const enviadasOuMais = propostas.filter((p) =>
    ["Enviada", "Aprovada", "Perdida"].includes(p.status),
  )
  const aprovadas = propostas.filter((p) => p.status === "Aprovada")
  const totalEnviadas = enviadasOuMais.length
  const totalAprovadas = aprovadas.length
  const taxaConversao = totalEnviadas ? Math.round((totalAprovadas / totalEnviadas) * 100) : 0
  const valorAprovado = aprovadas.reduce((a, p) => a + p.valorFinal, 0)

  // Aprovadas por mês (últimos 6 meses)
  const buckets: { key: string; mes: string; quantidade: number; valor: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anoAtual, mesAtual - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, mes: MESES[d.getMonth()], quantidade: 0, valor: 0 })
  }
  for (const p of aprovadas) {
    const d = new Date((p.dataEnvio || p.dataCriacao) + "T00:00:00")
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const b = buckets.find((x) => x.key === key)
    if (b) {
      b.quantidade += 1
      b.valor += p.valorFinal
    }
  }

  // Conversão por origem
  const origemMap = new Map<string, { enviadas: number; aprovadas: number; valor: number }>()
  for (const p of enviadasOuMais) {
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
    .sort((a, b) => b.valor - a.valor)

  // Disciplinas mais vendidas (contagem em todas as propostas)
  const discMap = new Map<string, number>()
  for (const p of propostas) {
    for (const d of p.disciplinas) discMap.set(d, (discMap.get(d) ?? 0) + 1)
  }
  const disciplinasMaisVendidas = Array.from(discMap.entries())
    .map(([disciplina, quantidade]) => ({ disciplina, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 6)

  // Por tipo de empreendimento (todas as propostas)
  const tipoMap = new Map<string, { quantidade: number; valor: number }>()
  for (const p of propostas) {
    const t = p.tipo || "—"
    const cur = tipoMap.get(t) ?? { quantidade: 0, valor: 0 }
    cur.quantidade += 1
    cur.valor += p.valorFinal
    tipoMap.set(t, cur)
  }
  const porTipoEmpreendimento = Array.from(tipoMap.entries())
    .map(([tipo, v]) => ({ tipo, quantidade: v.quantidade, valor: v.valor }))
    .sort((a, b) => b.quantidade - a.quantidade)

  // Clientes top (valor = soma de valorFinal das aprovadas)
  const clienteMap = new Map<string, { quantidade: number; valor: number }>()
  for (const p of aprovadas) {
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

  // Motivos de perda (propostas Perdida agrupadas por motivoPerda)
  const motivoMap = new Map<string, number>()
  for (const p of propostas.filter((x) => x.status === "Perdida")) {
    const m = p.motivoPerda || "Não informado"
    motivoMap.set(m, (motivoMap.get(m) ?? 0) + 1)
  }
  const motivosPerda = Array.from(motivoMap.entries())
    .map(([motivo, quantidade]) => ({ motivo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)

  // Funil (contagem por status)
  const funil = {
    emElaboracao: propostas.filter((p) => p.status === "Em elaboração").length,
    enviadas: propostas.filter((p) => p.status === "Enviada").length,
    aprovadas: totalAprovadas,
    perdidas: propostas.filter((p) => p.status === "Perdida").length,
  }

  const semRetorno = propostas
    .filter((p) => p.status === "Enviada" && p.diasSemRetorno >= 7)
    .sort((a, b) => b.diasSemRetorno - a.diasSemRetorno)

  return {
    criadasNoMes,
    taxaConversao,
    valorAprovado,
    totalEnviadas,
    totalAprovadas,
    aprovadasPorMes: buckets.map(({ mes, quantidade, valor }) => ({ mes, quantidade, valor })),
    conversaoPorOrigem,
    disciplinasMaisVendidas,
    porTipoEmpreendimento,
    clientesTop,
    motivosPerda,
    funil,
    semRetorno,
  }
}
