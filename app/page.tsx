"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  FileText,
  Send,
  Percent,
  CircleDollarSign,
  Receipt,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"
import { Shell, PageHeader } from "@/components/shell"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { getDashboard, type DashboardData } from "@/lib/db/dashboard"

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState("mes")
  const [modo, setModo] = useState<"quantidade" | "valor">("quantidade")
  const [statusFiltro, setStatusFiltro] = useState("Todos")
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    let active = true
    getDashboard()
      .then((d) => {
        if (active) setData(d)
      })
      .catch(() => {
        toast.error("Erro ao carregar o dashboard.")
      })
    return () => {
      active = false
    }
  }, [])

  const semRetornoTodas = data?.semRetorno ?? []
  const semRetorno = semRetornoTodas.filter(
    (p) => statusFiltro === "Todos" || p.status === statusFiltro,
  )
  const atencao = semRetorno.filter((p) => p.diasSemRetorno > 7)

  return (
    <Shell breadcrumb={["IEX", "Dashboard"]}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <PageHeader
          title="Dashboard comercial"
          description="Visão executiva de desempenho de propostas e conversão."
          actions={
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-border bg-card p-0.5">
                <button
                  onClick={() => setModo("quantidade")}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    modo === "quantidade" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Quantidade
                </button>
                <button
                  onClick={() => setModo("valor")}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    modo === "valor" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Valor
                </button>
              </div>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
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
              <Select value={periodo} onValueChange={setPeriodo}>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Propostas criadas no mês" value={`${data?.criadasNoMes ?? 0}`} icon={FileText} trend={{ value: "+22%", positive: true }} hint="vs. mês anterior" />
          <StatCard label="Propostas enviadas" value={`${data?.totalEnviadas ?? 0}`} icon={Send} trend={{ value: "+12%", positive: true }} hint="vs. mês anterior" />
          <StatCard label="Taxa de conversão" value={`${data?.taxaConversao ?? 0}%`} icon={Percent} trend={{ value: "+4 p.p.", positive: true }} hint="aprovadas / enviadas" />
          <StatCard label="Valor aprovado" value={formatBRL(data?.valorAprovado ?? 0)} icon={CircleDollarSign} trend={{ value: "+18%", positive: true }} hint="no mês" />
          <StatCard label="Ticket médio" value={formatBRL(data && data.totalAprovadas ? Math.round(data.valorAprovado / data.totalAprovadas) : 0)} icon={Receipt} trend={{ value: "-3%", positive: false }} hint="por proposta" />
          <StatCard label="Propostas aprovadas" value={`${data?.totalAprovadas ?? 0}`} icon={Clock} trend={{ value: "-0,6 dia", positive: true }} hint="no período" />
          {/* 'Tempo médio de elaboração' não possui campo correspondente em DashboardData; substituído por 'Propostas aprovadas' (totalAprovadas) conforme orientação. */}
        </div>

        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Funil de propostas</h3>
            <p className="text-xs text-muted-foreground">Distribuição por etapa do pipeline</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Em elaboração", value: data?.funil?.emElaboracao ?? 0 },
              { label: "Enviadas", value: data?.funil?.enviadas ?? 0 },
              { label: "Aprovadas", value: data?.funil?.aprovadas ?? 0 },
              { label: "Perdidas", value: data?.funil?.perdidas ?? 0 },
            ].map((f) => (
              <div key={f.label} className="rounded-md border border-border bg-card px-4 py-3">
                <p className="text-2xl font-semibold tabular-nums text-foreground">{f.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.label}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AprovadasChart mode={modo} data={data?.aprovadasPorMes ?? []} />
          </div>
          <ConversaoChart data={data?.conversaoPorOrigem ?? []} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TiposChart data={data?.porTipoEmpreendimento ?? []} />
          <MotivosPerdaChart data={data?.motivosPerda ?? []} />
          <ClientesChart data={data?.clientesTop ?? []} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DisciplinasChart data={data?.disciplinasMaisVendidas ?? []} />

          <Card className="lg:col-span-2 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Propostas sem retorno</h3>
                <p className="text-xs text-muted-foreground">
                  {statusFiltro === "Todos"
                    ? "Enviadas e aguardando resposta do cliente"
                    : `Filtrando por status: ${statusFiltro} · ${semRetorno.length} resultado(s)`}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/propostas">
                  Ver todas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
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
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhuma proposta para o status selecionado.
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
          </Card>
        </div>

        <Card className="border-warning/30 bg-warning/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warning/20 text-[oklch(0.5_0.12_75)]">
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
      </div>
    </Shell>
  )
}
