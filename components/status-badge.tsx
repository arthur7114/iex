import { cn } from "@/lib/utils"
import type { StatusProposta } from "@/lib/mock-data"

const styles: Record<StatusProposta, string> = {
  "Em elaboração": "bg-muted text-muted-foreground border-border",
  Enviada: "bg-gold/15 text-[oklch(0.45_0.08_75)] border-gold/30",
  Aprovada: "bg-positive/12 text-[oklch(0.4_0.1_155)] border-positive/30",
  Perdida: "bg-danger/10 text-danger border-danger/25",
}

const labels: Record<StatusProposta, string> = {
  "Em elaboração": "Em elaboração",
  Enviada: "Enviada / aguardando",
  Aprovada: "Aprovada",
  Perdida: "Perdida",
}

export function StatusBadge({ status }: { status: StatusProposta }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labels[status]}
    </span>
  )
}
