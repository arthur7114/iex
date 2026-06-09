"use client"

import { Building2, MapPin, Layers, TrendingDown, TrendingUp } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { type Proposta, formatBRL, formatDate } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function ProposalDrawer({
  proposta,
  open,
  onOpenChange,
}: {
  proposta: Proposta | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!proposta) return null

  const diff = proposta.valorFinal - proposta.valorSugerido
  const diffPct = proposta.valorSugerido ? (diff / proposta.valorSugerido) * 100 : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="space-y-3 border-b border-border p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{proposta.numero}</span>
            <StatusBadge status={proposta.status} />
          </div>
          <SheetTitle className="text-pretty text-lg">{proposta.empreendimento}</SheetTitle>
          <SheetDescription className="flex flex-col gap-1 text-left">
            <span className="flex items-center gap-1.5 text-foreground">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {proposta.cliente}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {proposta.cidade}/{proposta.uf} · {proposta.tipo} · {proposta.area.toLocaleString("pt-BR")} m²
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-6">
          <section className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Disciplinas
            </h4>
            <div className="space-y-2">
              {proposta.itens.map((item) => {
                const d = item.valorFinal - item.valorSugerido
                return (
                  <div
                    key={item.disciplinaId}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{item.disciplina}</span>
                    <span className="text-sm font-medium tabular-nums">{formatBRL(item.valorFinal)}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo financeiro</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Valor sugerido</p>
                <p className="text-base font-semibold tabular-nums">{formatBRL(proposta.valorSugerido)}</p>
              </div>
              <div className="rounded-md bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Valor final</p>
                <p className="text-base font-semibold tabular-nums">{formatBRL(proposta.valorFinal)}</p>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 text-sm",
                diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-[oklch(0.45_0.1_155)]" : "text-danger",
              )}
            >
              {diff > 0 ? <TrendingUp className="h-4 w-4" /> : diff < 0 ? <TrendingDown className="h-4 w-4" /> : null}
              <span>
                Diferença: {diff >= 0 ? "+" : ""}
                {formatBRL(diff)} ({diffPct >= 0 ? "+" : ""}
                {diffPct.toFixed(1)}%)
              </span>
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos passos</h4>
            <p className="text-sm text-foreground">{proposta.proximosPassos}</p>
            {proposta.motivoPerda && (
              <p className="text-sm text-danger">Motivo da perda: {proposta.motivoPerda}</p>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico de ações</h4>
            <ol className="relative space-y-4 border-l border-border pl-4">
              {proposta.historico.map((h, i) => (
                <li key={i} className="space-y-0.5">
                  <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm text-foreground">{h.acao}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(h.data)} · {h.usuario}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card p-4">
          <Button className="flex-1">Editar proposta</Button>
          <Button variant="outline" className="flex-1">Alterar status</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
