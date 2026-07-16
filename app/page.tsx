"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  FileText,
  Send,
  Percent,
  CircleDollarSign,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from "lucide-react"
import { Shell, PageHeader } from "@/components/shell"
import { StatCard, type StatTrend } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AprovadasChart,
  ConversaoChart,
  DisciplinasChart,
  TiposChart,
  MotivosPerdaChart,
  ClientesChart,
} from "@/components/dashboard-charts"
import { formatBRL, formatDate } from "@/lib/mock-data"
import { listarPropostas } from "@/lib/db/propostas"
import {
  computeDashboard,
  type PeriodoDashboard,
  type StatusFiltroDashboard,
  type TrendValue,
} from "@/lib/db/dashboard"
import type { Proposta, StatusProposta } from "@/lib/db/types"

// Contrato de query-string com a lista de propostas (/propostas?status=<StatusProposta>).
function propostasHref(status?: StatusProposta): string {
  return status ? `/propostas?status=${encodeURIComponent(status)}` : "/propostas"
}

// Converte a variação calculada (numérica) para o formato de exibição do StatCard.
function toStatTrend(t: TrendValue): StatTrend {
  if (t.delta === null) return { label: "", positive: t.positive, comparavel: false }
  const sign = t.delta > 0 ? "+" : ""
  const label = t.unit === "p.p." ? `${sign}${t.delta} p.p.` : `${sign}${t.delta}%`
  return { label, positive: t.positive, comparavel: true }
}

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>("mes")
  const [modo, setModo] = useState<"quantidade" | "valor">("quantidade")
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltroDashboard>("Todos")

  const [propostas, setPropostas] = useState<Proposta[] | null>(null)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setErro(false)
    setPropostas(null)
    listarPropostas()
      .then((d) => {
        if (ativo) setPropostas(d)
      })
      .catch(() => {
        if (ativo) {
          setErro(true)
          toast.error("Não foi possível carregar o dashboard.")
        }
      })
    return () => {
      ativo = false
    }
  }, [tentativa])

  // Recalcula todo o dashboard sempre que período ou status mudam (sem novo fetch).
  const data = useMemo(
    () =>
      propostas
        ? computeDashboard(propostas, { periodo, status: statusFiltro })
        : null,
    [propostas, periodo, statusFiltro],
  )

  const carregando = !data && !erro
  const semRetorno = data?.semRetorno ?? []
  const atencao = semRetorno.filter((p) => p.diasSemRetorno > 7)

  return (
    <Shell breadcrumb={["IEX", "Dashboard"]}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <PageHeader
          title="Dashboard comercial"
          description="Visão executiva de desempenho de propostas e conversão."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-border bg-card p-0.5">
                <button
                  onClick={() => setModo("quantidade")}
                  aria-pressed={modo === "quantidade"}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none ${
                    modo === "quantidade" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Quantidade
                </button>
                <button
                  onClick={() => setModo("valor")}
                  aria-pressed={modo === "valor"}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none ${
                    modo === "valor" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Valor
                </button>
              </div>
              <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltroDashboard)}>
                <SelectTrigger className="w-44 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os status</SelectItem>
                  <SelectItem value="Em elaboração">Em elaboração</SelectItem>
                  <SelectItem value="Enviada">Enviada</SelectItem>
                  <SelectItem value="Aprovada">Aprovada</SelectItem>
                  <SelectItem value="Perdida">Perdida</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDashboard)}>
                <SelectTrigger className="w-40 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Este mês</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="semestre">Semestre</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />

        {/* Contexto do período selecionado */}
        {data ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.periodoLabel}</span>
            {" · "}
            {data.intervaloLabel}
            {statusFiltro !== "Todos" && (
              <>
                {" · "}filtrando por status <span className="font-medium text-foreground">{statusFiltro}</span>
              </>
            )}
          </p>
        ) : (
          <Skeleton className="h-5 w-72" />
        )}

        {erro ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertTriangle className="h-6 w-6 text-danger" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Não foi possível carregar o dashboard</h3>
              <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTentativa((t) => t + 1)}>
              <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
            </Button>
          </Card>
        ) : carregando ? (
          <DashboardSkeleton />
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Propostas criadas"
                value={`${data.criadas}`}
                icon={FileText}
                trend={toStatTrend(data.trends.criadas)}
                hint={data.comparativoLabel}
                href={propostasHref()}
              />
              <StatCard
                label="Propostas enviadas"
                value={`${data.totalEnviadas}`}
                icon={Send}
                trend={toStatTrend(data.trends.totalEnviadas)}
                hint={data.comparativoLabel}
                href={propostasHref("Enviada")}
              />
              <StatCard
                label="Taxa de conversão"
                value={`${data.taxaConversao}%`}
                icon={Percent}
                trend={toStatTrend(data.trends.taxaConversao)}
                hint="aprovadas / enviadas"
                href={propostasHref("Aprovada")}
              />
              <StatCard
                label="Valor aprovado"
                value={formatBRL(data.valorAprovado)}
                icon={CircleDollarSign}
                trend={toStatTrend(data.trends.valorAprovado)}
                hint={data.comparativoLabel}
                href={propostasHref("Aprovada")}
              />
              <StatCard
                label="Ticket médio"
                value={formatBRL(data.ticketMedio)}
                icon={Receipt}
                trend={toStatTrend(data.trends.ticketMedio)}
                hint="por proposta aprovada"
                href={propostasHref("Aprovada")}
              />
              <StatCard
                label="Propostas aprovadas"
                value={`${data.totalAprovadas}`}
                icon={CheckCircle2}
                trend={toStatTrend(data.trends.totalAprovadas)}
                hint={data.comparativoLabel}
                href={propostasHref("Aprovada")}
              />
            </div>

            <Card className="p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Funil de propostas</h3>
                <p className="text-xs text-muted-foreground">Distribuição por etapa do pipeline · {data.periodoLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  { label: "Em elaboração", value: data.funil.emElaboracao, status: "Em elaboração" as StatusProposta },
                  { label: "Enviadas", value: data.funil.enviadas, status: "Enviada" as StatusProposta },
                  { label: "Aprovadas", value: data.funil.aprovadas, status: "Aprovada" as StatusProposta },
                  { label: "Perdidas", value: data.funil.perdidas, status: "Perdida" as StatusProposta },
                ]).map((f) => (
                  <Link
                    key={f.label}
                    href={propostasHref(f.status)}
                    className="group rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-ring hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  >
                    <p className="text-2xl font-semibold tabular-nums text-foreground">{f.value}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {f.label}
                      <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
                    </p>
                  </Link>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AprovadasChart mode={modo} data={data.aprovadasPorMes} periodoLabel={data.periodoLabel} />
              </div>
              <ConversaoChart data={data.conversaoPorOrigem} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <TiposChart data={data.porTipoEmpreendimento} />
              <MotivosPerdaChart data={data.motivosPerda} />
              <ClientesChart data={data.clientesTop} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <DisciplinasChart data={data.disciplinasMaisVendidas} periodoLabel={data.periodoLabel} />

              <Card className="lg:col-span-2 overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Propostas sem retorno</h3>
                    <p className="text-xs text-muted-foreground">
                      {statusFiltro === "Todos"
                        ? "Enviadas há 7+ dias aguardando resposta do cliente"
                        : `Filtrando por status: ${statusFiltro} · ${semRetorno.length} resultado(s)`}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="text-xs">
                    <Link href={propostasHref("Enviada")}>
                      Ver todas <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proposta</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Enviada em</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Dias</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semRetorno.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma proposta sem retorno no período selecionado.
                          </TableCell>
                        </TableRow>
                      )}
                      {semRetorno.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.numero}</TableCell>
                          <TableCell className="text-muted-foreground">{p.cliente}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(p.dataEnvio)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRL(p.valorFinal)}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`tabular-nums font-medium ${
                                p.diasSemRetorno > 7 ? "text-danger" : "text-muted-foreground"
                              }`}
                            >
                              {p.diasSemRetorno}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>

            {atencao.length > 0 && (
              <Card className="border-warning/30 bg-warning/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning/20 text-[oklch(0.5_0.12_75)] dark:text-[oklch(0.8_0.12_75)]">
                    <AlertTriangle className="h-[18px] w-[18px]" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Atenção comercial</h3>
                      <p className="text-sm text-muted-foreground">
                        {atencao.length} proposta(s) aguardando retorno há mais de 7 dias. Recomenda-se follow-up.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {atencao.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                        >
                          <div className="leading-tight">
                            <p className="text-xs font-medium text-foreground">{p.cliente}</p>
                            <p className="text-xs text-muted-foreground">{p.numero} · {p.diasSemRetorno} dias</p>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </Shell>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-20" />
              </div>
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
            <Skeleton className="mt-3 h-4 w-32" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[70px] w-full rounded-md" />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px] w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px] w-full rounded-xl" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </div>
    </div>
  )
}
