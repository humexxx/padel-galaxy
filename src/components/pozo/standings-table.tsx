import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { PlayerStanding } from "@/lib/pozo/types"

export function StandingsTable({
  standings,
  highlightTop = 3,
}: {
  standings: PlayerStanding[]
  highlightTop?: number
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Tabla de posiciones</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">#</TableHead>
              <TableHead>Jugador</TableHead>
              <TableHead className="text-center">PJ</TableHead>
              <TableHead className="text-center">PG</TableHead>
              <TableHead className="hidden text-center sm:table-cell">GF</TableHead>
              <TableHead className="hidden text-center sm:table-cell">GC</TableHead>
              <TableHead className="text-center">DIF</TableHead>
              <TableHead className="pr-4 text-right">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((s, i) => (
              <TableRow key={s.player.id} className={cn(i < highlightTop && "bg-primary/5")}>
                <TableCell className="pl-4 font-semibold tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{s.player.name}</TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {s.matchesPlayed}
                </TableCell>
                <TableCell className="text-center tabular-nums">{s.matchesWon}</TableCell>
                <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">
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
                <TableCell className="pr-4 text-right font-semibold tabular-nums">
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
