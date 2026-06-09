"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import {
  aprovadasPorMes,
  conversaoPorOrigem,
  disciplinasMaisVendidas,
  formatBRL,
} from "@/lib/mock-data"

const axisStyle = { fontSize: 12, fill: "var(--muted-foreground)" }

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          {p.name}: <span className="font-medium text-foreground">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function AprovadasChart({ mode }: { mode: "quantidade" | "valor" }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Propostas aprovadas — mês a mês</h3>
        <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={aprovadasPorMes} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="fillAprovadas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            width={mode === "valor" ? 56 : 32}
            tickFormatter={(v) => (mode === "valor" ? `${v / 1000}k` : `${v}`)}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v: number) => (mode === "valor" ? formatBRL(v) : `${v} propostas`)} />
            }
          />
          <Area
            type="monotone"
            dataKey={mode}
            name={mode === "valor" ? "Valor aprovado" : "Aprovadas"}
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#fillAprovadas)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

export function ConversaoChart() {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Conversão por origem</h3>
        <p className="text-xs text-muted-foreground">Taxa de aprovação por canal de entrada</p>
      </div>
      <div className="flex flex-col gap-3">
        {conversaoPorOrigem.map((o) => (
          <div key={o.origem} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{o.origem}</span>
              <span className="font-medium text-muted-foreground">{o.taxa}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${o.taxa}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function DisciplinasChart() {
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-1)"]
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Disciplinas mais vendidas</h3>
        <p className="text-xs text-muted-foreground">Volume nos últimos 12 meses</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={disciplinasMaisVendidas} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis
            type="category"
            dataKey="disciplina"
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            width={78}
          />
          <Tooltip cursor={{ fill: "var(--secondary)" }} content={<ChartTooltip formatter={(v: number) => `${v} propostas`} />} />
          <Bar dataKey="quantidade" name="Propostas" radius={[0, 4, 4, 0]} barSize={16}>
            {disciplinasMaisVendidas.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
