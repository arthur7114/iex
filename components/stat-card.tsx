import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface StatTrend {
  /** Texto já formatado, ex.: "+22%" ou "+4 p.p.". Ignorado quando comparavel = false. */
  label: string
  positive: boolean
  /** false => período anterior sem base; renderiza "sem base comparável". */
  comparavel: boolean
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  href,
}: {
  label: string
  value: string
  hint?: string
  trend?: StatTrend
  icon: LucideIcon
  href?: string
}) {
  const content = (
    <Card
      className={cn(
        "h-full p-5",
        href &&
          "transition-colors hover:border-ring hover:bg-accent/40 motion-reduce:transition-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {trend &&
          (trend.comparavel ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                trend.positive
                  ? "text-[oklch(0.45_0.1_155)] dark:text-[oklch(0.78_0.13_155)]"
                  : "text-danger",
              )}
            >
              {trend.positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {trend.label}
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">Sem base comparável</span>
          ))}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  )

  if (!href) return content

  return (
    <Link
      href={href}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${label}: ${value}. Ver propostas relacionadas`}
    >
      <div className="relative">
        {content}
        <ArrowRight className="pointer-events-none absolute right-5 bottom-5 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
      </div>
    </Link>
  )
}
