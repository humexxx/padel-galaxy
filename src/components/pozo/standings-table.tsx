import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { sortStandings, type StandingsSort } from "@/lib/pozo/standings"
import type { Match, PlayerStanding } from "@/lib/pozo/types"

type Props = {
  standings: PlayerStanding[]
  matches: Match[]
  highlightTop?: number
  defaultSort?: StandingsSort
}

export function StandingsTable({
  standings,
  matches,
  highlightTop = 3,
  defaultSort = "games",
}: Props) {
  const [sort, setSort] = React.useState<StandingsSort>(defaultSort)
  const sorted = React.useMemo(
    () => sortStandings(standings, sort, matches),
    [standings, sort, matches],
  )

  const activeGames = sort === "games"
  const activePoints = sort === "points"

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Tabla de posiciones</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeGames
              ? "Ordenado por suma de games ganados."
              : "PG → diferencia de games → cara a cara."}
          </p>
        </div>
        <Tabs
          value={sort}
          onValueChange={(v) => setSort(v as StandingsSort)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="games" className="text-xs">
              Por games
            </TabsTrigger>
            <TabsTrigger value="points" className="text-xs">
              Por puntos
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">#</TableHead>
              <TableHead>Jugador</TableHead>
              <TableHead className="text-center">PJ</TableHead>
              <TableHead className={cn("text-center", activePoints && "text-foreground")}>
                PG
              </TableHead>
              <TableHead
                className={cn(
                  "hidden text-center sm:table-cell",
                  activeGames && "text-foreground",
                )}
              >
                GF
              </TableHead>
              <TableHead className="hidden text-center sm:table-cell">GC</TableHead>
              <TableHead className="text-center">DIF</TableHead>
              <TableHead className="pr-4 text-right">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s, i) => (
              <TableRow key={s.player.id} className={cn(i < highlightTop && "bg-primary/5")}>
                <TableCell className="pl-4 font-semibold tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{s.player.name}</TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {s.matchesPlayed}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-center tabular-nums",
                    activePoints && "font-semibold text-foreground",
                  )}
                >
                  {s.matchesWon}
                </TableCell>
                <TableCell
                  className={cn(
                    "hidden text-center tabular-nums text-muted-foreground sm:table-cell",
                    activeGames && "font-semibold text-foreground",
                  )}
                >
                  {s.gamesWon}
                </TableCell>
                <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">
                  {s.gamesLost}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-center tabular-nums",
                    s.gamesDiff > 0 && "text-emerald-600 dark:text-emerald-400",
                    s.gamesDiff < 0 && "text-destructive",
                  )}
                >
                  {s.gamesDiff > 0 ? `+${s.gamesDiff}` : s.gamesDiff}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                  {s.points}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
