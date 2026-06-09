"use client"

import { useState } from "react"
import Link from "next/link"
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
} from "@/components/dashboard-charts"
import { propostas, formatBRL, formatDate } from "@/lib/mock-data"

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState("mes")
  const [modo, setModo] = useState<"quantidade" | "valor">("quantidade")

  const semRetorno = propostas
    .filter((p) => p.status === "Enviada")
    .sort((a, b) => b.diasSemRetorno - a.diasSemRetorno)
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
          <StatCard label="Propostas criadas no mês" value="11" icon={FileText} trend={{ value: "+22%", positive: true }} hint="vs. mês anterior" />
          <StatCard label="Propostas enviadas" value="9" icon={Send} trend={{ value: "+12%", positive: true }} hint="vs. mês anterior" />
          <StatCard label="Taxa de conversão" value="58%" icon={Percent} trend={{ value: "+4 p.p.", positive: true }} hint="aprovadas / enviadas" />
          <StatCard label="Valor aprovado" value={formatBRL(940000)} icon={CircleDollarSign} trend={{ value: "+18%", positive: true }} hint="no mês" />
          <StatCard label="Ticket médio" value={formatBRL(85400)} icon={Receipt} trend={{ value: "-3%", positive: false }} hint="por proposta" />
          <StatCard label="Tempo médio de elaboração" value="3,4 dias" icon={Clock} trend={{ value: "-0,6 dia", positive: true }} hint="da criação ao envio" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AprovadasChart mode={modo} />
          </div>
          <ConversaoChart />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DisciplinasChart />

          <Card className="lg:col-span-2 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Propostas sem retorno</h3>
                <p className="text-xs text-muted-foreground">Enviadas e aguardando resposta do cliente</p>
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
