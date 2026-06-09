"use client"

import { Sparkles, Info, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type CopilotTone = "info" | "positive" | "caution"

export interface CopilotMessage {
  tone: CopilotTone
  text: string
}

const toneStyles: Record<CopilotTone, string> = {
  info: "border-l-primary/50",
  positive: "border-l-[oklch(0.55_0.1_155)]",
  caution: "border-l-warning",
}

export function AICopilotPanel({
  messages,
  confianca,
}: {
  messages: CopilotMessage[]
  confianca?: number
}) {
  return (
    <Card className="flex h-full flex-col p-0">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary">
          <Sparkles className="h-[18px] w-[18px]" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">Copiloto de precificação</p>
          <p className="text-xs text-muted-foreground">Apoio consultivo · você decide</p>
        </div>
      </div>

      {typeof confianca === "number" && (
        <div className="border-b border-border px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confiança da sugestão</span>
            <span className="font-medium text-foreground">{confianca}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${confianca}%` }} />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 rounded-md border border-border border-l-2 bg-secondary/40 p-3",
              toneStyles[m.tone],
            )}
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-foreground">{m.text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 border-t border-border px-4 py-3">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Esta é uma recomendação, não uma decisão automática. A definição final de preço, condições e envio é
          sempre sua.
        </p>
      </div>
    </Card>
  )
}
