"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function WizardStepper({
  steps,
  current,
  onSelect,
}: {
  steps: string[]
  current: number
  onSelect: (index: number) => void
}) {
  return (
    <nav aria-label="Etapas da proposta">
      <ol className="flex flex-col gap-1">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={label}>
              <button
                onClick={() => onSelect(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="truncate">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
