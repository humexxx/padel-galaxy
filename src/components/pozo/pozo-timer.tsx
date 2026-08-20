import * as React from "react"
import { motion } from "framer-motion"
import { BellIcon, BellOffIcon, BellRingIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import {
  isTimerAlarmRinging,
  primeTimerAlarm,
  startTimerAlarm,
  stopTimerAlarm,
  subscribeTimerAlarm,
} from "@/lib/alarm"
import { setTimerAlarmEnabled, useTimerAlarmEnabled } from "@/lib/preferences"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/time"

type Props = {
  label: string
  endsAt: number
  variant?: "warmup" | "play"
  /** "large" makes the timer visually dominant — used during warmup when
   * there's nothing else on screen. "default" is the in-play compact size. */
  size?: "default" | "large"
  /** Secondary countdown pinned to the card's top-right corner — used for
   * the whole-pozo clock while the main digits track the current match. */
  secondary?: { label: string; endsAt: number }
  /** Beep (+ vibrate) when the main countdown hits zero, and keep beeping
   * until it's dealt with. Renders a bell toggle in the top-left corner so
   * the feature can be muted from this screen; the preference persists
   * per-device in localStorage. */
  alarm?: boolean
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
  secondary,
  alarm = false,
}: Props) {
  const now = useNow(1000)
  const remaining = Math.max(0, endsAt - now)
  const ended = remaining === 0
  const isLarge = size === "large"

  const alarmEnabled = useTimerAlarmEnabled()
  const ringing = React.useSyncExternalStore(
    subscribeTimerAlarm,
    isTimerAlarmRinging,
    () => false,
  )

  // Fire only on the transition >0 → 0 while mounted. Initializing the ref
  // with the current remaining means a timer that mounts already expired
  // (e.g. reopening a stale pozo) stays silent.
  const prevRemaining = React.useRef(remaining)
  React.useEffect(() => {
    const prev = prevRemaining.current
    prevRemaining.current = remaining
    if (alarm && alarmEnabled && prev > 0 && remaining === 0) {
      startTimerAlarm()
    }
  }, [alarm, alarmEnabled, remaining])

  // Moving on IS the dismissal: "Empezar a jugar" and each round change push
  // endsAt into the future, so the clock leaving zero silences the alarm
  // without anyone having to hunt for a stop button.
  React.useEffect(() => {
    if (remaining > 0) stopTimerAlarm()
  }, [remaining])

  // Muting the bell mid-ring should shut it up now, not just next time.
  React.useEffect(() => {
    if (!alarmEnabled) stopTimerAlarm()
  }, [alarmEnabled])

  // Leaving the pozo (finish, navigate away) must not leave it ringing into
  // an unmounted tree — nothing would be left to stop it.
  React.useEffect(() => () => stopTimerAlarm(), [])

  // The beep is scheduled from a timer callback, which iOS won't accept as a
  // reason to start audio. Piggyback on the first touch anywhere on the page
  // to open the context while a gesture is still on the stack.
  React.useEffect(() => {
    if (!alarm || !alarmEnabled) return
    const unlock = () => primeTimerAlarm()
    const opts = { once: true, passive: true } as const
    window.addEventListener("pointerdown", unlock, opts)
    window.addEventListener("keydown", unlock, opts)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [alarm, alarmEnabled])

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
      {alarm && (
        <button
          type="button"
          onClick={() => {
            // Turning the bell back on is itself a gesture — the best moment
            // to unlock audio, and it doubles as a "did that work?" test.
            if (!alarmEnabled) primeTimerAlarm()
            setTimerAlarmEnabled(!alarmEnabled)
          }}
          aria-label={alarmEnabled ? "Silenciar alarma" : "Activar alarma"}
          title={
            alarmEnabled
              ? "Suena una alarma cuando el tiempo llega a cero"
              : "Alarma silenciada"
          }
          className="absolute top-2.5 left-2.5 rounded-full p-2 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          {alarmEnabled ? (
            <BellIcon className="size-4" />
          ) : (
            <BellOffIcon className="size-4" />
          )}
        </button>
      )}
      {secondary && (
        <div className="absolute top-2.5 right-2.5 rounded-lg bg-background/60 px-2.5 py-1.5 text-right backdrop-blur-sm">
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {secondary.label}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground/80">
            {formatDuration(Math.max(0, secondary.endsAt - now))}
          </p>
        </div>
      )}
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
      {ringing && (
        <Button
          type="button"
          variant="destructive"
          onClick={stopTimerAlarm}
          // Thumb-sized: this gets tapped in a hurry, on a phone, courtside.
          className="mt-4 h-11 w-full gap-2 sm:w-auto sm:px-8"
        >
          <BellRingIcon className="size-4 animate-pulse" />
          Detener alarma
        </Button>
      )}
    </motion.div>
  )
}
