"use client"

import { Sparkles, Info, ShieldCheck, CircleCheck, TriangleAlert, Cpu } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type CopilotTone = "info" | "positive" | "caution"

export interface CopilotMessage {
  tone: CopilotTone
  text: string
}

export type CopilotFonte = "ia" | "heuristica"

export interface CopilotComparaveis {
  quantidade: number
  medianaReaisM2: number | null
}

// Tom transmitido pelo ícone (cor pontual, sem faixas coloridas nas bordas).
const toneIcon: Record<CopilotTone, { Icon: typeof Info; className: string; label: string }> = {
  info: { Icon: Info, className: "text-primary", label: "Informação" },
  positive: { Icon: CircleCheck, className: "text-[oklch(0.5_0.12_155)]", label: "Ponto positivo" },
  caution: { Icon: TriangleAlert, className: "text-warning", label: "Atenção" },
}

function FonteBadge({ fonte }: { fonte: CopilotFonte }) {
  if (fonte === "ia") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Cpu className="h-3 w-3" aria-hidden />
        Gerado por IA
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Info className="h-3 w-3" aria-hidden />
      Heurística local
    </Badge>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <Card className="flex h-full min-w-0 flex-col p-0">{children}</Card>
}

function Header({ fonte }: { fonte?: CopilotFonte }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
          <Sparkles className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-foreground">Copiloto de precificação</p>
          <p className="truncate text-xs text-muted-foreground">Apoio consultivo · você decide</p>
        </div>
      </div>
      {fonte && <FonteBadge fonte={fonte} />}
    </div>
  )
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-2 border-t border-border px-4 py-3">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Esta é uma recomendação, não uma decisão automática. O copiloto nunca altera o preço — a definição final de
        valor, condições e envio é sempre sua.
      </p>
    </div>
  )
}

// Estado de carregamento: mantém a moldura e a mensagem de segurança.
export function AICopilotPanelSkeleton() {
  return (
    <Shell>
      <Header />
      <div className="space-y-3 p-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Analisando a precificação…</span>
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
      <Disclaimer />
    </Shell>
  )
}

export function AICopilotPanel({
  messages,
  confianca,
  fonte,
  comparaveis,
}: {
  messages: CopilotMessage[]
  confianca?: number
  fonte?: CopilotFonte
  comparaveis?: CopilotComparaveis
}) {
  const origemTexto =
    fonte === "ia"
      ? "Análise elaborada por IA a partir dos parâmetros do projeto e do histórico comparável."
      : fonte === "heuristica"
        ? "Análise gerada pela heurística local (sem IA), com base nos parâmetros do projeto e no histórico disponível."
        : null

  return (
    <Shell>
      <Header fonte={fonte} />

      {origemTexto && (
        <p className="border-b border-border px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {origemTexto}
        </p>
      )}

      {typeof confianca === "number" && (
        <div className="border-b border-border px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confiança da sugestão</span>
            <span className="font-medium text-foreground tabular-nums">{confianca}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={confianca} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${confianca}%` }} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {messages.map((m, i) => {
          const { Icon, className, label } = toneIcon[m.tone]
          return (
            <div key={i} className="flex min-w-0 gap-2 rounded-md border border-border bg-secondary/40 p-3">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} aria-hidden />
              <p className="min-w-0 break-words text-sm leading-relaxed text-foreground">
                <span className="sr-only">{label}: </span>
                {m.text}
              </p>
            </div>
          )
        })}
      </div>

      {comparaveis && (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          {comparaveis.medianaReaisM2 !== null
            ? `Baseado em ${comparaveis.quantidade} proposta(s) comparável(is) — mediana de referência disponível.`
            : "Sem histórico comparável suficiente; análise baseada apenas nos parâmetros do projeto."}
        </p>
      )}

      <Disclaimer />
    </Shell>
  )
}
