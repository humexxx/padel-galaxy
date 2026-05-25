import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/time"

type Props = {
  label: string
  endsAt: number
  now: number
  variant?: "warmup" | "play"
}

export function PozoTimer({ label, endsAt, now, variant = "play" }: Props) {
  const remaining = Math.max(0, endsAt - now)
  const ended = remaining === 0

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 text-center shadow-sm",
        variant === "warmup"
          ? "from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30"
          : "from-primary/10 via-primary/5 to-transparent border-primary/30",
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "font-mono text-5xl font-bold tabular-nums tracking-tight sm:text-7xl",
            ended ? "text-destructive" : variant === "warmup" ? "text-amber-600 dark:text-amber-400" : "text-primary",
          )}
          aria-live="polite"
        >
          {formatDuration(remaining)}
        </p>
        <p className="text-xs text-muted-foreground">
          {ended ? "Tiempo terminado" : "Tiempo restante"}
        </p>
      </div>
    </div>
  )
}
