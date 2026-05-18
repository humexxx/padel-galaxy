import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tabla de posiciones</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Jugador</th>
                <th className="px-2 py-2 text-center font-medium">PJ</th>
                <th className="px-2 py-2 text-center font-medium">PG</th>
                <th className="px-2 py-2 text-center font-medium">GF</th>
                <th className="px-2 py-2 text-center font-medium">GC</th>
                <th className="px-2 py-2 text-center font-medium">DIF</th>
                <th className="px-3 py-2 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.player.id}
                  className={cn(
                    "border-b last:border-0 transition",
                    i < highlightTop && "bg-primary/5",
                  )}
                >
                  <td className="px-4 py-2.5 font-semibold tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2.5 font-medium">{s.player.name}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                    {s.matchesPlayed}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums">{s.matchesWon}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                    {s.gamesWon}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                    {s.gamesLost}
                  </td>
                  <td className={cn("px-2 py-2.5 text-center tabular-nums", s.gamesDiff > 0 && "text-emerald-600 dark:text-emerald-400", s.gamesDiff < 0 && "text-destructive")}>
                    {s.gamesDiff > 0 ? `+${s.gamesDiff}` : s.gamesDiff}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
