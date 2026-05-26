import { motion } from "framer-motion"

import { useNow } from "@/hooks/use-now"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/time"

type Props = {
  label: string
  endsAt: number
  variant?: "warmup" | "play"
  /** "large" makes the timer visually dominant — used during warmup when
   * there's nothing else on screen. "default" is the in-play compact size. */
  size?: "default" | "large"
}

/**
 * Self-contained timer: owns its own `useNow` subscription so the 1 Hz tick
 * only re-renders THIS component, not the entire parent tree. Pulling the
 * tick up to a parent forced every sibling (MatchCards, StandingsTable, etc.)
 * to re-render 60×/min during a pozo for no useful reason.
 */
export function PozoTimer({
  label,
  endsAt,
  variant = "play",
  size = "default",
}: Props) {
  const now = useNow(1000)
  const remaining = Math.max(0, endsAt - now)
  const ended = remaining === 0
  const isLarge = size === "large"

  return (
    <motion.div
      layout
      // Anchor the layout scale to the centroid so the box shrinks
      // symmetrically (top edge moves down AND bottom edge moves up) instead
      // of pinning to the top edge of the parent stack.
      style={{ transformOrigin: "50% 50%" }}
      transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br text-center shadow-sm transition-colors duration-300",
        // Symmetric padding (p-* applies to all four sides) — both top and
        // bottom shrink in lockstep.
        isLarge ? "p-8 sm:p-12" : "p-6",
        variant === "warmup"
          ? "from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30"
          : "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/40",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      {/* The digits get their own layout animation so the size change scales
          from their own centerline (transform-origin: 50% 50%) instead of
          the inherited top-anchored text baseline. */}
      <motion.p
        layout
        style={{ transformOrigin: "50% 50%" }}
        transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        className={cn(
          "mt-2 font-mono font-bold tabular-nums tracking-tight",
          isLarge ? "text-7xl sm:text-9xl" : "text-5xl sm:text-7xl",
          ended
            ? "text-destructive"
            : variant === "warmup"
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400",
        )}
        aria-live="polite"
      >
        {formatDuration(remaining)}
      </motion.p>
      <p className="mt-2 text-xs text-muted-foreground">
        {ended ? "Tiempo terminado" : "Tiempo restante"}
      </p>
    </motion.div>
  )
}
