import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Match, Player } from "@/lib/pozo/types"

type Props = {
  match: Match
  playerById: Map<string, Player>
  onSubmit: (matchId: string, gamesA: number, gamesB: number) => void
  readOnly?: boolean
}

function parseScore(value: string): number | null {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function MatchCard({ match, playerById, onSubmit, readOnly }: Props) {
  const hasResult = match.gamesA !== null && match.gamesB !== null
  const [gamesA, setGamesA] = React.useState(match.gamesA?.toString() ?? "")
  const [gamesB, setGamesB] = React.useState(match.gamesB?.toString() ?? "")

  // Sync local state when the match updates from outside (Firestore subscription).
  React.useEffect(() => {
    setGamesA(match.gamesA?.toString() ?? "")
    setGamesB(match.gamesB?.toString() ?? "")
  }, [match.gamesA, match.gamesB])

  const teamAWon =
    match.gamesA !== null && match.gamesB !== null && match.gamesA > match.gamesB
  const teamBWon =
    match.gamesA !== null && match.gamesB !== null && match.gamesB > match.gamesA

  const playerName = (id: string) => playerById.get(id)?.name ?? "—"

  function maybeSave(nextA: string, nextB: string) {
    const a = parseScore(nextA)
    const b = parseScore(nextB)
    if (a === null || b === null) return
    if (a === match.gamesA && b === match.gamesB) return
    onSubmit(match.id, a, b)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Cancha {match.court}
        </CardTitle>
        <Badge variant={hasResult ? "secondary" : "outline"}>
          {hasResult ? "Cargado" : "Pendiente"}
        </Badge>
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
                onChange={setGamesA}
                onBlur={() => maybeSave(gamesA, gamesB)}
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
                onChange={setGamesB}
                onBlur={() => maybeSave(gamesA, gamesB)}
                aria-label="Games equipo B"
              />
            )
          }
        />
      </CardContent>
    </Card>
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
  onBlur,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "onBlur">) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="h-10 w-14 text-center text-lg font-semibold tabular-nums"
      {...rest}
    />
  )
}

function ScoreDisplay({ value }: { value: number | null }) {
  return (
    <span className="inline-flex h-10 w-14 items-center justify-center rounded-md bg-muted text-xl font-semibold tabular-nums">
      {value ?? "–"}
    </span>
  )
}
