"use client"

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
import type { PlayerStanding } from "@/lib/pozo/types"

type Props = {
  standings: PlayerStanding[]
  highlightTop?: number
  defaultSort?: StandingsSort
}

export function StandingsTable({
  standings,
  highlightTop = 3,
  defaultSort = "games",
}: Props) {
  const [sort, setSort] = React.useState<StandingsSort>(defaultSort)
  const sorted = React.useMemo(() => sortStandings(standings, sort), [standings, sort])

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <CardTitle className="text-base">Tabla de posiciones</CardTitle>
        <Tabs value={sort} onValueChange={(v) => setSort(v as StandingsSort)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="games" className="text-xs">Por games</TabsTrigger>
            <TabsTrigger value="points" className="text-xs">Por puntos</TabsTrigger>
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
              <TableHead className={cn("text-center", sort === "points" && "text-foreground")}>
                PG
              </TableHead>
              <TableHead className={cn("hidden text-center sm:table-cell", sort === "games" && "text-foreground")}>
                GF
              </TableHead>
              <TableHead className="hidden text-center sm:table-cell">GC</TableHead>
              <TableHead className="text-center">DIF</TableHead>
              <TableHead className={cn("pr-4 text-right", sort === "points" && "text-foreground")}>
                Pts
              </TableHead>
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
                    sort === "points" && "font-semibold",
                  )}
                >
                  {s.matchesWon}
                </TableCell>
                <TableCell
                  className={cn(
                    "hidden text-center tabular-nums text-muted-foreground sm:table-cell",
                    sort === "games" && "font-semibold text-foreground",
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
                <TableCell
                  className={cn(
                    "pr-4 text-right tabular-nums",
                    sort === "points" ? "font-semibold" : "text-muted-foreground",
                  )}
                >
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
