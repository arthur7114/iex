import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  trend?: { value: string; positive: boolean }
  icon: LucideIcon
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trend.positive ? "text-[oklch(0.45_0.1_155)]" : "text-danger",
            )}
          >
            {trend.positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {trend.value}
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  )
}
