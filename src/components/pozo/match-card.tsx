"use client"

import * as React from "react"
import { CheckIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Match, Player } from "@/lib/pozo/types"

type Props = {
  match: Match
  playerById: Map<string, Player>
  onSubmit: (matchId: string, gamesA: number, gamesB: number) => void
  readOnly?: boolean
}

export function MatchCard({ match, playerById, onSubmit, readOnly }: Props) {
  const hasResult = match.gamesA !== null && match.gamesB !== null
  const [editing, setEditing] = React.useState(!hasResult)
  const [gamesA, setGamesA] = React.useState(match.gamesA?.toString() ?? "")
  const [gamesB, setGamesB] = React.useState(match.gamesB?.toString() ?? "")

  const teamAWon =
    match.gamesA !== null && match.gamesB !== null && match.gamesA > match.gamesB
  const teamBWon =
    match.gamesA !== null && match.gamesB !== null && match.gamesB > match.gamesA

  const playerName = (id: string) => playerById.get(id)?.name ?? "—"

  function commit() {
    const a = Number.parseInt(gamesA, 10)
    const b = Number.parseInt(gamesB, 10)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
      toast.error("Ingresá un puntaje válido")
      return
    }
    onSubmit(match.id, a, b)
    setEditing(false)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Cancha {match.court}
        </CardTitle>
        {hasResult && !editing ? (
          <div className="flex items-center gap-1">
            <Badge variant="secondary">Cargado</Badge>
            {!readOnly && (
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(true)} aria-label="Editar resultado">
                <PencilIcon className="size-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <Badge variant="outline">Pendiente</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <TeamRow
          highlight={teamAWon}
          dimmed={teamBWon}
          players={[playerName(match.teamA.playerA), playerName(match.teamA.playerB)]}
          score={
            editing && !readOnly ? (
              <ScoreInput value={gamesA} onChange={setGamesA} aria-label="Games equipo A" />
            ) : (
              <ScoreDisplay value={match.gamesA} />
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
            editing && !readOnly ? (
              <ScoreInput value={gamesB} onChange={setGamesB} aria-label="Games equipo B" />
            ) : (
              <ScoreDisplay value={match.gamesB} />
            )
          }
        />
        {editing && !readOnly && (
          <Button size="sm" className="w-full" onClick={commit}>
            <CheckIcon className="size-4" />
            Guardar resultado
          </Button>
        )}
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
        "flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 transition",
        highlight && "border-primary/60 bg-primary/5",
        dimmed && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium">{players[0]}</span>
        <span className="truncate text-xs text-muted-foreground">{players[1]}</span>
      </div>
      <div>{score}</div>
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
