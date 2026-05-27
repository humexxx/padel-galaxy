import * as React from "react"
import { Link, useParams } from "react-router"
import { ArrowLeftIcon, FolderIcon } from "lucide-react"
// NOTE: we don't use the shared `<LineChart>` (src/components/ui/line-chart.tsx)
// here on purpose. That component is single-series with optional secondary
// axis — designed for the player-detail page. This view needs N dynamic
// lines (one per visible player), per-line color toggles, and a multi-row
// rich tooltip. Generalizing `<LineChart>` to cover both use cases would
// bloat its API; recharts is already lazy-loaded per route so there's no
// bundle cost to keeping the implementations separate.
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { useGroup } from "@/hooks/use-groups"
import { useGroupPozos } from "@/hooks/use-group-pozos"
import {
  PERIOD_LABELS,
  aggregateGroup,
  rangeFor,
  type CalendarPeriod,
  type PlayerPozoEntry,
} from "@/lib/group-stats"
import type { StandingsSort } from "@/lib/pozo/standings"
import { cn } from "@/lib/utils"

const SORT_TABS: { key: StandingsSort; label: string }[] = [
  { key: "games", label: "Games" },
  { key: "matchesWon", label: "Partidos" },
  { key: "points", label: "Puntos" },
]

const PERIOD_SHORT: Record<CalendarPeriod, string> = {
  month: "Mes",
  quarter: "Trim",
  semester: "Sem",
  year: "Año",
}

/** Color palette for chart lines — cycles when more than 8 players are shown. */
const LINE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
]

const METRIC_KEY: Record<StandingsSort, keyof PlayerPozoEntry> = {
  games: "gamesWon",
  matchesWon: "matchesWon",
  points: "points",
}

export function GrupoDetallePage() {
  const params = useParams<{ id: string }>()
  const id = params.id ?? ""
  const { group, hydrated: groupHydrated } = useGroup(id)
  const { pozos, hydrated: pozosHydrated } = useGroupPozos(id)
  const [period, setPeriod] = React.useState<CalendarPeriod>("month")
  const [sort, setSort] = React.useState<StandingsSort>("games")
  const [bestPerWeek, setBestPerWeek] = React.useState(false)

  const range = React.useMemo(() => rangeFor(period), [period])
  const { aggregate, entries, pozosInRange, typicalPlayersPerPozo } = React.useMemo(
    () => aggregateGroup(pozos, range, sort, { bestPerWeek }),
    [pozos, range, sort, bestPerWeek],
  )

  // Visible players in the chart — default to the top N (where N = the
  // typical pozo size). Stored as a Set so toggling is O(1). `null` means
  // "not yet initialized" so we know to auto-select on first data arrival.
  const [visibleIds, setVisibleIds] = React.useState<Set<string> | null>(null)
  // Only auto-init once, AND only after the aggregate is populated —
  // otherwise the first render (with empty aggregate) would persist an
  // empty Set and the auto-select would never fire when data arrives.
  // Once initialized, manual toggles persist across period/sort re-aggregates.
  React.useEffect(() => {
    if (visibleIds !== null) return
    if (aggregate.length === 0) return
    const defaultN = Math.max(1, typicalPlayersPerPozo || 4)
    const ids = new Set(aggregate.slice(0, defaultN).map((s) => s.player.id))
    setVisibleIds(ids)
  }, [aggregate, typicalPlayersPerPozo, visibleIds])

  const effectiveVisible = visibleIds ?? new Set<string>()

  function toggleVisible(playerId: string) {
    setVisibleIds((prev) => {
      const base = prev ?? new Set(aggregate.slice(0, Math.max(1, typicalPlayersPerPozo || 4)).map((s) => s.player.id))
      const next = new Set(base)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  // Build chart data: one row per pozo (or week if best-per-week), columns
  // keyed by playerId. recharts can read each <Line>'s dataKey from there.
  const chartData = React.useMemo(() => {
    if (entries.length === 0) return [] as Array<Record<string, number | string>>
    const byPozo = new Map<
      string,
      Record<string, number | string>
    >()
    const visibleEntries = entries.filter((e) => effectiveVisible.has(e.playerId))
    const metric = METRIC_KEY[sort]
    for (const e of visibleEntries) {
      // Use weekKey when collapsing best-per-week so weeks line up across
      // players. Otherwise use pozoId so each pozo is its own X tick.
      const xKey = bestPerWeek ? e.weekKey : e.pozoId
      const row = byPozo.get(xKey) ?? { _x: xKey, date: e.date, pozoName: e.pozoName }
      row[e.playerId] = e[metric] as number
      // Keep the latest date for the X-axis label.
      if ((e.date as number) > (row.date as number)) {
        row.date = e.date
      }
      byPozo.set(xKey, row)
    }
    return [...byPozo.values()].sort(
      (a, b) => (a.date as number) - (b.date as number),
    )
  }, [entries, effectiveVisible, sort, bestPerWeek])

  // Map playerId → color for stable colors across chart re-renders.
  // Must stay above the early returns below — hooks can't be conditional.
  const playerColors = React.useMemo(() => {
    const map = new Map<string, string>()
    aggregate.forEach((s, i) => {
      map.set(s.player.id, LINE_COLORS[i % LINE_COLORS.length])
    })
    return map
  }, [aggregate])

  if (!groupHydrated) {
    return (
      <PageContainer>
        <Card className="h-48 animate-pulse">
          <CardContent />
        </Card>
      </PageContainer>
    )
  }

  if (!group) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <Text className="text-base font-semibold">Grupo no encontrado.</Text>
            <Button asChild>
              <Link to="/pozos">Volver</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver" className="shrink-0">
          <Link to="/pozos">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderIcon className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <Heading level="h1">{group.name}</Heading>
            <Text variant="muted">
              {pozos.length} {pozos.length === 1 ? "pozo" : "pozos"} en el grupo · ~
              {typicalPlayersPerPozo} jugadores por pozo
            </Text>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabla general</CardTitle>
          <CardDescription>
            {pozosInRange} {pozosInRange === 1 ? "pozo" : "pozos"} en{" "}
            {PERIOD_LABELS[period].toLowerCase()}
            {bestPerWeek && " · solo el mejor por semana"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={sort} onValueChange={(v) => setSort(v as StandingsSort)}>
              <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                {SORT_TABS.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as CalendarPeriod)}>
              <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                {(Object.keys(PERIOD_LABELS) as CalendarPeriod[]).map((p) => (
                  <TabsTrigger key={p} value={p} className="text-xs">
                    {PERIOD_SHORT[p]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="best-per-week" className="text-sm font-medium">
                Mejor marcador por semana
              </Label>
              <p className="text-xs text-muted-foreground">
                Si un jugador participó en varios pozos de la misma semana,
                cuenta solo el de mejor {SORT_TABS.find((s) => s.key === sort)?.label.toLowerCase()}.
              </p>
            </div>
            <Switch
              id="best-per-week"
              checked={bestPerWeek}
              onCheckedChange={setBestPerWeek}
            />
          </div>

          {!pozosHydrated ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted/30" />
          ) : aggregate.length === 0 ? (
            <Text variant="muted" className="py-6 text-center text-sm">
              Sin estadísticas para el período seleccionado.
            </Text>
          ) : (
            <div className="-mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-md sm:border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-4" title="Mostrar línea en el gráfico">
                      ●
                    </TableHead>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Jugador</TableHead>
                    <TableHead className="text-center" title="Pozos en los que jugó">
                      Pozos
                    </TableHead>
                    <TableHead className="text-center" title="Partidos ganados">
                      PG
                    </TableHead>
                    <TableHead className="hidden text-center sm:table-cell" title="Games a favor">
                      Games
                    </TableHead>
                    <TableHead className="text-center" title="Diferencia de games">
                      DIF
                    </TableHead>
                    <TableHead className="pr-4 text-right font-semibold" title="Puntos">
                      Pts
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregate.map((s, i) => {
                    const visible = effectiveVisible.has(s.player.id)
                    const color = playerColors.get(s.player.id) ?? "var(--color-muted-foreground)"
                    return (
                      <TableRow key={s.player.id} className={cn(i < 3 && "bg-primary/5")}>
                        <TableCell className="pl-4">
                          <button
                            type="button"
                            onClick={() => toggleVisible(s.player.id)}
                            aria-label={visible ? "Ocultar en gráfico" : "Mostrar en gráfico"}
                            aria-pressed={visible}
                            className={cn(
                              "inline-flex size-4 items-center justify-center rounded-full border transition-colors",
                              visible
                                ? "border-transparent"
                                : "border-border bg-transparent",
                            )}
                            style={visible ? { background: color, borderColor: color } : undefined}
                          />
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          <Link
                            to={`/jugadores/${s.player.id}`}
                            state={{ from: `/pozos/grupos/${group.id}` }}
                            className="hover:underline"
                          >
                            {s.player.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground">
                          {s.pozosPlayed}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold">
                          {s.matchesWon}
                        </TableCell>
                        <TableCell className="hidden text-center tabular-nums text-muted-foreground sm:table-cell">
                          {s.gamesWon}
                        </TableCell>
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
                        <TableCell className="pr-4 text-right tabular-nums font-semibold text-foreground">
                          {s.points}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolución</CardTitle>
          <CardDescription>
            Una línea por cada jugador seleccionado. Tocá el círculo al inicio de
            cada fila de la tabla para mostrar u ocultar su línea.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pozosHydrated ? (
            <div className="h-60 animate-pulse rounded-lg bg-muted/30" />
          ) : chartData.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
              <Text variant="muted" className="text-sm">
                {aggregate.length === 0
                  ? `Sin pozos finalizados en ${PERIOD_LABELS[period].toLowerCase()}.`
                  : "Marcá al menos un jugador en la tabla para ver su evolución."}
              </Text>
            </div>
          ) : (
            <div className="h-80 w-full sm:h-[26rem]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart
                  data={chartData}
                  margin={{ top: 12, right: 12, bottom: 0, left: -8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickFormatter={(v) =>
                      new Date(Number(v)).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })
                    }
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0].payload as Record<string, number | string>
                      return (
                        <div
                          style={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 12,
                            color: "var(--color-popover-foreground)",
                            minWidth: 160,
                          }}
                        >
                          <div className="font-semibold">{String(row.pozoName ?? "—")}</div>
                          <div className="text-muted-foreground">
                            {new Date(Number(row.date)).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {aggregate
                              .filter((s) => effectiveVisible.has(s.player.id) && row[s.player.id] !== undefined)
                              .map((s) => (
                                <div
                                  key={s.player.id}
                                  className="flex justify-between gap-4 text-xs"
                                >
                                  <span
                                    className="inline-flex items-center gap-1.5 text-muted-foreground"
                                  >
                                    <span
                                      aria-hidden
                                      className="size-1.5 rounded-full"
                                      style={{ background: playerColors.get(s.player.id) }}
                                    />
                                    {s.player.name}
                                  </span>
                                  <span className="font-semibold text-foreground">
                                    {String(row[s.player.id])}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )
                    }}
                  />
                  {aggregate
                    .filter((s) => effectiveVisible.has(s.player.id))
                    .map((s) => (
                      <Line
                        key={s.player.id}
                        type="monotone"
                        dataKey={s.player.id}
                        name={s.player.name}
                        stroke={playerColors.get(s.player.id) ?? "var(--color-primary)"}
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: playerColors.get(s.player.id) ?? "var(--color-primary)" }}
                        activeDot={{ r: 5 }}
                        connectNulls
                        isAnimationActive
                        animationDuration={300}
                      />
                    ))}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Métrica: <strong>{SORT_TABS.find((s) => s.key === sort)?.label}</strong>
            {" · "}Eje X: {bestPerWeek ? "una semana ISO" : "un pozo"} por punto. Cambialo desde la
            tabla arriba.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
