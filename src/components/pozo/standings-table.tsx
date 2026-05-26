import * as React from "react"
import { Link, useLocation } from "react-router"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  STANDINGS_SORT_LABELS,
  sortStandings,
  type StandingsSort,
} from "@/lib/pozo/standings"
import type { Match, PlayerStanding } from "@/lib/pozo/types"

type Props = {
  standings: PlayerStanding[]
  matches: Match[]
  highlightTop?: number
  defaultSort?: StandingsSort
  /** Controlled sort. When provided, internal state is ignored. */
  sort?: StandingsSort
  /** Called when the user changes the sort. Always fires (controlled or not). */
  onSortChange?: (sort: StandingsSort) => void
}

const SORT_ORDER: StandingsSort[] = ["games", "matchesWon", "points"]

const SORT_DESCRIPTIONS: Record<StandingsSort, string> = {
  games: "Ordenado por suma de games ganados.",
  matchesWon: "PG → diferencia de games → cara a cara.",
  points: "Pts (3 por PG + 1 por PE) → diferencia → cara a cara.",
}

const SORT_SHORT_LABELS: Record<StandingsSort, string> = {
  games: "Games",
  matchesWon: "Partidos",
  points: "Puntos",
}

export function StandingsTable({
  standings,
  matches,
  highlightTop = 3,
  defaultSort = "games",
  sort: controlledSort,
  onSortChange,
}: Props) {
  const [internalSort, setInternalSort] = React.useState<StandingsSort>(defaultSort)
  const sort = controlledSort ?? internalSort
  function setSort(next: StandingsSort) {
    if (controlledSort === undefined) setInternalSort(next)
    onSortChange?.(next)
  }

  const sorted = React.useMemo(
    () => sortStandings(standings, sort, matches),
    [standings, sort, matches],
  )

  // Pass current URL as state.from so the player-detail back arrow returns here.
  const location = useLocation()
  const fromPath = location.pathname + location.search

  // Two column layouts. Games mode shows games totals + diff; match-focused
  // modes show wins/ties/losses + diff (+ points only for "points").
  const gamesFocused = sort === "games"
  const matchFocused = !gamesFocused
  const showPoints = sort === "points"

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Tabla de posiciones</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {SORT_DESCRIPTIONS[sort]}
          </p>
        </div>
        <TooltipProvider delay={300}>
          <Tabs
            value={sort}
            onValueChange={(v) => setSort(v as StandingsSort)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              {SORT_ORDER.map((s) => (
                <Tooltip key={s}>
                  <TooltipTrigger
                    render={
                      <TabsTrigger value={s} className="text-xs">
                        {SORT_SHORT_LABELS[s]}
                      </TabsTrigger>
                    }
                  />
                  <TooltipContent>{STANDINGS_SORT_LABELS[s]}</TooltipContent>
                </Tooltip>
              ))}
            </TabsList>
          </Tabs>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">#</TableHead>
              <TableHead>Jugador</TableHead>
              <TableHead className="text-center" title="Partidos jugados">
                PJ
              </TableHead>
              {matchFocused && (
                <TableHead
                  className={cn(
                    "text-center",
                    sort === "matchesWon" && "font-semibold text-foreground",
                  )}
                  title="Partidos ganados"
                >
                  PG
                </TableHead>
              )}
              {matchFocused && (
                <TableHead className="hidden text-center sm:table-cell" title="Partidos empatados">
                  PE
                </TableHead>
              )}
              {matchFocused && (
                <TableHead className="text-center" title="Partidos perdidos">
                  PP
                </TableHead>
              )}
              {gamesFocused && (
                <TableHead
                  className={cn(
                    "text-center",
                    sort === "games" && "font-semibold text-foreground",
                  )}
                  title="Games a favor (suma de games ganados)"
                >
                  Games
                </TableHead>
              )}
              {gamesFocused && (
                <TableHead
                  className="hidden text-center sm:table-cell"
                  title="Games en contra"
                >
                  Contra
                </TableHead>
              )}
              <TableHead
                className="text-center"
                title="Diferencia de games (a favor − en contra)"
              >
                DIF
              </TableHead>
              {showPoints && (
                <TableHead
                  className="pr-4 text-right font-semibold text-foreground"
                  title="Puntos (3 por partido ganado, 1 por empate)"
                >
                  Pts
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s, i) => (
              <TableRow key={s.player.id} className={cn(i < highlightTop && "bg-primary/5")}>
                <TableCell className="pl-4 font-semibold tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">
                  <Link
                    to={`/jugadores/${s.player.id}`}
                    state={{ from: fromPath }}
                    className="hover:underline"
                  >
                    {s.player.name}
                  </Link>
                </TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {s.matchesPlayed}
                </TableCell>
                {matchFocused && (
                  <TableCell
                    className={cn(
                      "text-center tabular-nums",
                      sort === "matchesWon"
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {s.matchesWon}
                  </TableCell>
                )}
                {matchFocused && (
                  <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">
                    {s.matchesTied}
                  </TableCell>
                )}
                {matchFocused && (
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    {s.matchesLost}
                  </TableCell>
                )}
                {gamesFocused && (
                  <TableCell
                    className={cn(
                      "text-center tabular-nums",
                      sort === "games"
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {s.gamesWon}
                  </TableCell>
                )}
                {gamesFocused && (
                  <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">
                    {s.gamesLost}
                  </TableCell>
                )}
                <TableCell
                  className={cn(
                    "text-center tabular-nums",
                    s.gamesDiff > 0 && "text-emerald-600 dark:text-emerald-400",
                    s.gamesDiff < 0 && "text-destructive",
                    s.gamesDiff === 0 && "text-muted-foreground",
                  )}
                >
                  {s.gamesDiff > 0 ? `+${s.gamesDiff}` : s.gamesDiff}
                </TableCell>
                {showPoints && (
                  <TableCell className="pr-4 text-right tabular-nums font-semibold text-foreground">
                    {s.points}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
