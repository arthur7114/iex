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
