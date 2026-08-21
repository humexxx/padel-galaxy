import * as React from "react"
import { CheckIcon, Loader2Icon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Match, Player } from "@/lib/pozo/types"

type Props = {
  match: Match
  playerById: Map<string, Player>
  onSubmit: (matchId: string, gamesA: number, gamesB: number) => void
  readOnly?: boolean
}

type SaveState = "idle" | "saving" | "saved"

const SAVE_DEBOUNCE_MS = 400
const SAVED_FADE_MS = 1400

function parseScore(value: string): number | null {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export const MatchCard = React.memo(MatchCardImpl)

/**
 * Implementation behind the memoized export. React.memo bails out on
 * re-renders when none of (match, playerById, onSubmit, readOnly) changed by
 * reference. Combined with the always-fresh `pozoRef` in `usePozo`, the
 * parent's `onSubmit` (= recordResult) and `playerById` stay stable across
 * the 1 Hz timer tick — so cards only re-render when their own match
 * actually changes (Firestore push, local edit) or the readOnly flag flips.
 */
function MatchCardImpl({ match, playerById, onSubmit, readOnly }: Props) {
  const [gamesA, setGamesA] = React.useState(match.gamesA?.toString() ?? "")
  const [gamesB, setGamesB] = React.useState(match.gamesB?.toString() ?? "")
  const [saveState, setSaveState] = React.useState<SaveState>("idle")
  const fadeRef = React.useRef<number | null>(null)
  const isFirstSyncRef = React.useRef(true)

  // Sync local state when the match updates from outside (Firestore
  // subscription, admin auto-fill, another device, etc.). Skip the very
  // first run (initial mount) so we don't flash "Guardado" for data that
  // was already there before the user opened the round.
  React.useEffect(() => {
    setGamesA(match.gamesA?.toString() ?? "")
    setGamesB(match.gamesB?.toString() ?? "")
    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false
      return
    }
    // External writes that produce a complete score flash the badge as
    // "Guardado" too — same UX as a local edit completing.
    if (match.gamesA !== null && match.gamesB !== null) {
      setSaveState("saved")
      if (fadeRef.current) window.clearTimeout(fadeRef.current)
      fadeRef.current = window.setTimeout(() => setSaveState("idle"), SAVED_FADE_MS)
    }
  }, [match.gamesA, match.gamesB])

  const teamAWon =
    match.gamesA !== null && match.gamesB !== null && match.gamesA > match.gamesB
  const teamBWon =
    match.gamesA !== null && match.gamesB !== null && match.gamesB > match.gamesA

  const playerName = (id: string) => playerById.get(id)?.name ?? "—"

  // Debounced auto-save: every keystroke schedules a save 400ms later and
  // resets if the user keeps typing. The cleanup flushes any pending save on
  // unmount (so navigating to the next round persists in-flight edits).
  const debounceRef = React.useRef<number | null>(null)

  // saveRef.current always holds the latest "best known" save fn so the
  // unmount cleanup uses up-to-date local state without stale closures.
  // Assigned in an effect (not during render) per the rules of refs; the
  // only readers run after paint (debounce timer, unmount cleanup), so the
  // one-frame lag is unobservable.
  const saveRef = React.useRef<() => void>(() => undefined)
  React.useEffect(() => {
    saveRef.current = () => {
      const a = parseScore(gamesA)
      const b = parseScore(gamesB)
      if (a === null || b === null) return
      if (a === match.gamesA && b === match.gamesB) return
      onSubmit(match.id, a, b)
      setSaveState("saved")
      if (fadeRef.current) window.clearTimeout(fadeRef.current)
      fadeRef.current = window.setTimeout(() => setSaveState("idle"), SAVED_FADE_MS)
    }
  })

  function scheduleSave(nextA: string, nextB: string) {
    setGamesA(nextA)
    setGamesB(nextB)
    const a = parseScore(nextA)
    const b = parseScore(nextB)
    // Only enter "saving" once both scores are complete numbers — avoids
    // flashing the indicator while the user types the first digit.
    if (a === null || b === null) return
    if (a === match.gamesA && b === match.gamesB) return
    setSaveState("saving")
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      saveRef.current()
    }, SAVE_DEBOUNCE_MS)
  }

  // Flush on unmount: if the user clicked "Siguiente ronda" mid-typing, the
  // last edit still gets persisted before the card disappears.
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
        saveRef.current()
      }
      if (fadeRef.current) {
        window.clearTimeout(fadeRef.current)
      }
    }
  }, [])

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Cancha {match.court}
        </CardTitle>
        {/* CardAction is always rendered so the header keeps a stable
            grid layout — the badge inside fades in/out without affecting
            the card's height. */}
        <CardAction>
          <SaveBadge state={saveState} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <TeamRow
          highlight={teamAWon}
          dimmed={teamBWon}
          players={[playerName(match.teamA.playerA), playerName(match.teamA.playerB)]}
          score={
            readOnly ? (
              <ScoreDisplay value={match.gamesA} />
            ) : (
              <ScoreInput
                value={gamesA}
                onChange={(v) => scheduleSave(v, gamesB)}
                aria-label="Games equipo A"
              />
            )
          }
        />
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> vs <span className="h-px flex-1 bg-border" />
        </div>
        <TeamRow
          highlight={teamBWon}
          dimmed={teamAWon}
          players={[playerName(match.teamB.playerA), playerName(match.teamB.playerB)]}
          score={
            readOnly ? (
              <ScoreDisplay value={match.gamesB} />
            ) : (
              <ScoreInput
                value={gamesB}
                onChange={(v) => scheduleSave(gamesA, v)}
                aria-label="Games equipo B"
              />
            )
          }
        />
      </CardContent>
    </Card>
  )
}

/**
 * Save indicator with a STABLE footprint — fixed height + min-width sized
 * to the widest possible label ("Guardando…"). When idle, an invisible
 * placeholder of the same shape holds the slot open so the card header
 * never reflows by even a pixel as the badge fades in/out.
 *
 * `key={state}` re-runs the fade-in animation on each transition.
 */
function SaveBadge({ state }: { state: SaveState }) {
  return (
    <span
      // grid + place-items-end lets the active label and the invisible
      // placeholder stack on the SAME cell, so width is locked to whichever
      // is widest (typically "Guardando…").
      className="grid h-5 place-items-end text-xs font-medium leading-none"
      aria-live="polite"
    >
      {/* Invisible width-reservation row: never changes, never animates. */}
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 inline-flex items-center gap-1"
      >
        <Loader2Icon className="size-3" />
        Guardando…
      </span>
      {/* Active label, overlaid on the same grid cell. */}
      {state !== "idle" && (
        <span
          key={state}
          className={cn(
            "col-start-1 row-start-1 inline-flex items-center gap-1",
            "animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
            state === "saving" && "text-muted-foreground",
            state === "saved" && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {state === "saving" ? (
            <>
              <Loader2Icon className="size-3 animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <CheckIcon className="size-3.5" />
              Guardado
            </>
          )}
        </span>
      )}
    </span>
  )
}

function TeamRow({
  players,
  score,
  highlight,
  dimmed,
}: {
  players: [string, string]
  score: React.ReactNode
  highlight?: boolean
  dimmed?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5 transition",
        highlight && "border-primary/60 bg-primary/5",
        dimmed && "opacity-60",
      )}
    >
      <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
        <li className="truncate text-sm font-medium leading-tight">{players[0]}</li>
        <li className="truncate text-sm font-medium leading-tight">{players[1]}</li>
      </ul>
      <div className="shrink-0">{score}</div>
    </div>
  )
}

function ScoreInput({
  value,
  onChange,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // Score entry is the highest-traffic control in a pozo and gets
      // tapped in a hurry — 44px tall clears Apple's minimum.
      className="h-11 w-14 text-center text-lg font-semibold tabular-nums"
      {...rest}
    />
  )
}

function ScoreDisplay({ value }: { value: number | null }) {
  return (
    <span className="inline-flex h-11 w-14 items-center justify-center rounded-md bg-muted text-xl font-semibold tabular-nums">
      {value ?? "–"}
    </span>
  )
}
