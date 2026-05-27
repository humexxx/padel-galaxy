import * as React from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClockIcon,
  MailIcon,
  TrendingUpIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LineChart } from "@/components/ui/line-chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { GroupMultiSelect } from "@/components/pozo/group-multi-select"
import { useAuth } from "@/contexts/auth-context"
import { useGroups } from "@/hooks/use-groups"
import { usePlayer } from "@/hooks/use-players"
import { usePlayerHistory } from "@/hooks/use-player-history"
import { sendPlayerInvite } from "@/lib/invites"
import { cn } from "@/lib/utils"
import type { StandingsSort } from "@/lib/pozo/standings"
import type { PlayerPozoStat } from "@/lib/player-stats"

// Reuse the same filter keys as the standings table — keeps the tabs in
// sync across the pozo and player screens (a sort selected on one is the
// same concept as on the other). `finalPosition` lives on the right axis
// only, so it's NOT a Metric here.
type Metric = StandingsSort
type DateRange = "7d" | "30d" | "90d" | "all"

const METRIC_LABELS: Record<Metric, string> = {
  games: "Games",
  matchesWon: "Partidos",
  points: "Puntos",
}

const METRIC_DESCRIPTIONS: Record<Metric, string> = {
  games: "Games ganados por pozo · posición final en el ranking por games.",
  matchesWon: "Partidos ganados por pozo · posición final en el ranking por partidos.",
  points: "Puntos por pozo (3 por PG + 1 por PE) · posición en el ranking por puntos.",
}

// Map the UI metric key (which matches StandingsSort) to the actual field on
// PlayerPozoStat. Only "games" differs — the data field is `gamesWon` because
// internally we always store the raw count.
function dataFieldFor(metric: Metric): keyof PlayerPozoStat {
  if (metric === "games") return "gamesWon"
  return metric
}

const RANGE_LABELS: Record<DateRange, string> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "Todo",
}

const RANGE_DAYS: Record<DateRange, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
}

/**
 * Tooltip renderer factory. Defined at module scope so we can build a fresh
 * closure per render (keyed by `metricLabel`) WITHOUT creating an inline
 * fat-arrow on every render — that would invalidate any internal memo inside
 * `<LineChart>` and re-render the recharts subtree unnecessarily.
 */
function renderTooltip(metricLabel: string) {
  return (p: Record<string, number | string | null>) => (
    <>
      <div className="font-semibold">{String(p.pozoName)}</div>
      <div className="text-muted-foreground">
        {new Date(Number(p.date)).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: "var(--color-primary)" }}
        />
        {metricLabel}:{" "}
        <span className="font-semibold text-foreground">
          {p.value != null ? String(p.value) : "—"}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: "var(--color-chart-2)" }}
        />
        Posición:{" "}
        <span className="font-semibold text-foreground">
          {p.finalPosition != null ? `${p.finalPosition}°` : "—"}
        </span>
      </div>
    </>
  )
}

export function JugadorDetallePage() {
  const params = useParams<{ id: string }>()
  const id = params.id ?? ""
  const location = useLocation()
  const navigate = useNavigate()
  const { player, hydrated } = usePlayer(id)
  const { groups } = useGroups()
  const [metric, setMetric] = React.useState<Metric>("games")
  const [range, setRange] = React.useState<DateRange>("all")
  // Empty Set = no filter (all groups). Each id in the set is included.
  // Pozos with `groupId === null` (created before groups existed) only show
  // up when the set is empty.
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<Set<string>>(
    () => new Set(),
  )

  // If the user arrived via Link state.from (e.g. clicking a player's name
  // inside a pozo detail or group detail), the back arrow returns to that URL.
  // Otherwise we fall back to the players roster. Plain const — the
  // expression is cheap enough that `useMemo` would add overhead.
  const fromState = location.state as { from?: string } | null
  const backTo = typeof fromState?.from === "string" ? fromState.from : "/jugadores"

  const handleBack = React.useCallback(() => {
    navigate(backTo)
  }, [navigate, backTo])

  // Stable tooltip renderer per `metric` so the recharts subtree doesn't see
  // a new prop reference on unrelated re-renders (e.g. filter changes).
  const tooltipRenderer = React.useMemo(
    () => renderTooltip(METRIC_LABELS[metric]),
    [metric],
  )

  // Metric IS the StandingsSort — pass it straight through. Switching the
  // tab re-fetches history with positions recomputed against that ranking.
  const { history, hydrated: historyHydrated } = usePlayerHistory(id, metric)

  // IMPORTANT: every hook on this component must run before the early
  // returns below. React tracks hooks by call order — bailing out before
  // a `useMemo` on first render and then running it on the next throws
  // "Rendered more hooks than during the previous render".
  const data = React.useMemo(() => {
    const days = RANGE_DAYS[range]
    const cutoff = days === null ? -Infinity : Date.now() - days * 24 * 60 * 60 * 1000
    // The chart consumes a stable `value` key for the primary line, decoupled
    // from the data-field name (gamesWon vs games etc.). finalPosition rides
    // along under its own key on the right axis.
    const field = dataFieldFor(metric)
    const noGroupFilter = selectedGroupIds.size === 0
    return history
      .filter((h) => h.date >= cutoff)
      .filter(
        (h) =>
          noGroupFilter ||
          (h.groupId !== null && selectedGroupIds.has(h.groupId)),
      )
      .map((h) => ({
        date: h.date,
        pozoName: h.pozoName,
        pozoId: h.pozoId,
        value: h[field] as number,
        finalPosition: h.finalPosition,
      }))
  }, [history, metric, range, selectedGroupIds])

  if (!hydrated) {
    return (
      <PageContainer>
        <Card className="h-48 animate-pulse">
          <CardContent />
        </Card>
      </PageContainer>
    )
  }

  if (!player) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <Text className="text-base font-semibold">Jugador no encontrado.</Text>
            <Button asChild>
              <Link to="/jugadores">Volver al roster</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="flex items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Volver"
          onClick={handleBack}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="flex flex-1 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserIcon className="size-6" />
          </div>
          <div>
            <Heading level="h1">{player.name}</Heading>
            <AccountStatus
              linkedUid={player.linkedUid}
              invitedEmail={player.invitedEmail}
              invitedAt={player.invitedAt}
            />
          </div>
        </div>
      </div>

      <InviteCard player={player} />

      <Card>
        <CardHeader>
          <CardTitle>Evolución</CardTitle>
          <CardDescription>{METRIC_DESCRIPTIONS[metric]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
                  <TabsTrigger key={m} value={m} className="text-xs">
                    {METRIC_LABELS[m]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs value={range} onValueChange={(v) => setRange(v as DateRange)}>
              <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
                  <TabsTrigger key={r} value={r} className="text-xs">
                    {RANGE_LABELS[r]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {groups.length > 0 && (
            <GroupMultiSelect
              groups={groups}
              value={selectedGroupIds}
              onChange={setSelectedGroupIds}
            />
          )}

          {!historyHydrated ? (
            <div className="h-60 animate-pulse rounded-lg bg-muted/30" />
          ) : data.length === 0 ? (
            // Skip rendering the chart entirely when there are no points —
            // an empty <LineChart /> still reserves ~240 px of whitespace,
            // which reads as "broken" instead of "no data yet". The
            // dedicated empty state below carries enough vertical weight
            // that the card section still feels intentional.
            <EmptyHistoryState
              hasAnyHistory={history.length > 0}
              rangeLabel={RANGE_LABELS[range].toLowerCase()}
              hasGroupFilter={selectedGroupIds.size > 0}
            />
          ) : (
            <LineChart
              data={data}
              xKey="date"
              primary={{
                // Data rows always use `value` — the dataFieldFor mapping
                // happens upstream when we build the row, so the chart
                // doesn't have to know whether the user picked games /
                // partidos / puntos.
                key: "value",
                label: METRIC_LABELS[metric],
                color: "var(--color-primary)",
                formatY: (v) => String(v),
              }}
              secondary={{
                key: "finalPosition",
                label: "Posición",
                color: "var(--color-chart-2)",
                invertY: true,
                formatY: (v) => `${v}°`,
              }}
              formatX={(v) =>
                new Date(Number(v)).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                })
              }
              tooltipLabel={tooltipRenderer}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}

/**
 * Visual empty state for the Evolución card. Replaces an empty recharts
 * canvas (which renders as a confusing ~240 px white box) with an icon +
 * heading + helper copy. Three flavors of copy:
 *
 *   1. `hasAnyHistory=false` — the player has no finished pozos at all yet.
 *   2. `hasGroupFilter=true` — they have history, but the group multi-select
 *      filtered it all out.
 *   3. otherwise — they have history, but nothing inside the date range.
 *
 * Kept inline (not exported) because the copy is specific to this page —
 * if we end up needing a similar widget elsewhere we'll lift it then.
 */
function EmptyHistoryState({
  hasAnyHistory,
  rangeLabel,
  hasGroupFilter,
}: {
  hasAnyHistory: boolean
  rangeLabel: string
  hasGroupFilter: boolean
}) {
  let title: string
  let body: string
  if (!hasAnyHistory) {
    title = "Sin pozos todavía"
    body =
      "Cuando termines tu primer pozo vas a ver acá tu evolución de games, partidos y puntos."
  } else if (hasGroupFilter) {
    title = "Sin datos para los grupos seleccionados"
    body =
      "Probá quitar algún grupo del filtro, o ampliar el rango de fechas."
  } else {
    title = `Sin pozos en los últimos ${rangeLabel}`
    body = "Probá con un rango más amplio para ver tu historial completo."
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <TrendingUpIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <Text className="text-base font-semibold">{title}</Text>
        <Text variant="muted" className="max-w-md text-sm">
          {body}
        </Text>
      </div>
    </div>
  )
}

function AccountStatus({
  linkedUid,
  invitedEmail,
  invitedAt,
}: {
  linkedUid: string | null
  invitedEmail: string | null
  invitedAt: number | null
}) {
  if (linkedUid) {
    return (
      <p className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2Icon className="size-4" />
        Cuenta vinculada
      </p>
    )
  }
  if (invitedAt) {
    return (
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <ClockIcon className="size-4" />
        Invitación enviada a {invitedEmail}{" "}
        <span className="text-xs">
          ({new Date(invitedAt).toLocaleDateString("es-AR")})
        </span>
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1 text-sm text-muted-foreground">
      <MailIcon className="size-4" />
      Sin cuenta — todavía no fue invitado
    </p>
  )
}

function InviteCard({
  player,
}: {
  player: {
    id: string
    ownerId: string
    name: string
    linkedUid: string | null
    invitedEmail: string | null
    invitedAt: number | null
    nameLower: string
    createdAt: number
    updatedAt: number
  }
}) {
  const { user } = useAuth()
  const [email, setEmail] = React.useState(player.invitedEmail ?? "")
  const [sending, setSending] = React.useState(false)

  // Don't render if the player already linked their own account.
  if (player.linkedUid) return null

  async function handleSend() {
    if (!user) return
    setSending(true)
    try {
      await sendPlayerInvite({
        player,
        email,
        ownerName: user.displayName || user.email || "Padel Galaxy",
        appUrl: window.location.origin,
      })
      toast.success(
        player.invitedAt ? "Invitación re-enviada" : "Invitación enviada",
      )
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "No se pudo enviar")
    } finally {
      setSending(false)
    }
  }

  const isResend = player.invitedAt !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isResend ? "Reenviar invitación" : "Invitar a vincular cuenta"}
        </CardTitle>
        <CardDescription>
          Pegale un email y le mandamos un link para que cree su cuenta y vea sus
          stats.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="email@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!email.trim() || sending}
            className={cn(isResend && "sm:min-w-32")}
          >
            <MailIcon className="size-4" />
            {sending ? "Enviando…" : isResend ? "Reenviar" : "Enviar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
