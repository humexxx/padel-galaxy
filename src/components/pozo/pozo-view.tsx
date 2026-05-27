import * as React from "react"
import { Link, useNavigate } from "react-router"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  FolderIcon,
  PlayIcon,
  RotateCcwIcon,
  Trophy,
  WandSparklesIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { useGroups } from "@/hooks/use-groups"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { MatchCard } from "@/components/pozo/match-card"
import { Podium } from "@/components/pozo/podium"
import { PozoStatusBadge } from "@/components/pozo/status-badge"
import { PozoTimer } from "@/components/pozo/pozo-timer"
import { StandingsTable } from "@/components/pozo/standings-table"
import {
  advanceRound,
  beginPlay,
  finishPozo,
  getCurrentMatches,
  isRoundComplete,
  recordMatchResult,
  startPozo,
} from "@/lib/pozo/factory"
import { computeStandings, sortStandings, type StandingsSort } from "@/lib/pozo/standings"
import type { Pozo } from "@/lib/pozo/types"

type UpdaterFn = (current: Pozo) => Pozo

type Props = {
  pozo: Pozo
  onUpdate: (updater: UpdaterFn) => void
}

export function PozoView({ pozo, onUpdate }: Props) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const playerById = React.useMemo(
    () => new Map(pozo.players.map((p) => [p.id, p])),
    [pozo.players],
  )
  const roundComplete = isRoundComplete(pozo)
  const standings = React.useMemo(
    () => computeStandings(pozo.players, pozo.matches),
    [pozo.players, pozo.matches],
  )
  const isLastRound = pozo.currentRound + 1 >= pozo.totalRounds

  // Independent UI state: which round is currently DISPLAYED. Defaults to the
  // active round and follows it forward as the pozo advances, but the user can
  // navigate back to fix scores. Never goes past currentRound (future rounds
  // don't exist yet).
  const [viewedRound, setViewedRound] = React.useState(pozo.currentRound)
  React.useEffect(() => {
    setViewedRound(pozo.currentRound)
  }, [pozo.currentRound])
  const safeViewed = Math.min(viewedRound, pozo.currentRound)
  const viewedMatches = pozo.matches.filter((m) => m.round === safeViewed)
  const isViewingCurrent = safeViewed === pozo.currentRound

  // Stable identity so memoized MatchCards don't bust their cache on every
  // parent render. `onUpdate` from `usePozo` is itself dep-less (reads from
  // a ref), so this callback is too.
  //
  // MUST stay above the early-return branches below — otherwise the hook
  // count changes when `pozo.status` transitions from "draft" → "warmup"
  // (when the user clicks "Empezar"), which trips the Rules of Hooks
  // check and crashes with "Rendered more hooks than during the previous
  // render."
  const recordResult = React.useCallback(
    (matchId: string, gamesA: number, gamesB: number) => {
      // Auto-save lives in MatchCard now (with its own ephemeral indicator),
      // so we don't toast on every keystroke. The card shows "Guardando…" /
      // "Guardado" briefly above the score inputs.
      onUpdate((p) => recordMatchResult(p, matchId, gamesA, gamesB))
    },
    [onUpdate],
  )

  if (pozo.status === "draft") {
    return (
      <PozoDraftView
        pozo={pozo}
        onStart={() => onUpdate((p) => startPozo(p))}
        onBack={() => navigate("/pozos")}
        onChangeGroup={(groupId) => onUpdate((p) => ({ ...p, groupId }))}
      />
    )
  }

  if (pozo.status === "finished") {
    return (
      <FinishedView
        pozo={pozo}
        onBack={() => navigate("/pozos")}
        onChangeGroup={(groupId) => onUpdate((p) => ({ ...p, groupId }))}
      />
    )
  }

  const warmupActive = pozo.status === "warmup" && pozo.warmupEndsAt !== null
  const warmupEndsAt = pozo.warmupEndsAt ?? 0
  const endsAt = pozo.endsAt ?? 0

  function handleNextRound() {
    onUpdate((p) => advanceRound(p))
  }

  function handleFinishEarly() {
    onUpdate((p) => finishPozo(p))
    toast.success("Pozo cerrado")
  }

  /**
   * Admin shortcut: fill any unscored match in the current round with random
   * scores 0-7 (and never a tie). Chains all updates inside one onUpdate so
   * Firestore gets a single write.
   */
  function fillRoundRandomly() {
    onUpdate((p) => {
      let next = p
      for (const m of getCurrentMatches(p)) {
        if (m.gamesA !== null && m.gamesB !== null) continue
        let a = Math.floor(Math.random() * 8)
        let b = Math.floor(Math.random() * 8)
        if (a === b) b = (b + 1) % 8
        next = recordMatchResult(next, m.id, a, b)
      }
      return next
    })
  }

  function handleChangeGroup(groupId: string | undefined) {
    onUpdate((p) => ({ ...p, groupId }))
  }

  return (
    <PageContainer>
      <PozoHeader
        pozo={pozo}
        onFinish={handleFinishEarly}
        showFinish
        onChangeGroup={handleChangeGroup}
      />

      {/* Single timer instance: keep it mounted across warmup → play so
          framer-motion's layout can interpolate the size change AND Tailwind's
          transition-colors can animate the amber → emerald swap on the same
          DOM node. */}
      <PozoTimer
        label={warmupActive ? "Calentamiento" : "Pozo en juego"}
        endsAt={warmupActive ? warmupEndsAt : endsAt}
        variant={warmupActive ? "warmup" : "play"}
        size={warmupActive ? "large" : "default"}
      />
      <AnimatePresence>
        {warmupActive && (
          <motion.div
            key="empezar"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Button
              size="lg"
              onClick={() => onUpdate((p) => beginPlay(p))}
              className="w-full"
            >
              <PlayIcon className="size-5" />
              Empezar a jugar
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!warmupActive && (
          <motion.div
            key="play-controls"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, delay: 0.05, ease: "easeOut" }}
            className="space-y-4"
          >
      <Tabs defaultValue="matches" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="matches">Partidos</TabsTrigger>
          <TabsTrigger value="standings">Posiciones</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setViewedRound((r) => Math.max(0, r - 1))}
              disabled={safeViewed === 0}
              aria-label="Ronda anterior"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-medium">
                Ronda {safeViewed + 1} de {pozo.totalRounds}
              </p>
              {!isViewingCurrent && (
                <button
                  type="button"
                  onClick={() => setViewedRound(pozo.currentRound)}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Volver a la ronda actual
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setViewedRound((r) => Math.min(pozo.currentRound, r + 1))}
              disabled={safeViewed >= pozo.currentRound}
              aria-label="Ronda siguiente"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
          <RoundProgress current={pozo.currentRound} total={pozo.totalRounds} />
          {warmupActive && isViewingCurrent ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
              <Text variant="muted">
                Los partidos aparecen al terminar el calentamiento.
              </Text>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {viewedMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  playerById={playerById}
                  onSubmit={recordResult}
                  readOnly={pozo.status !== "playing"}
                />
              ))}
            </div>
          )}
          {isViewingCurrent && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {isAdmin && !roundComplete && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={fillRoundRandomly}
                  title="Cargar scores al azar en los partidos sin resultado (admin)"
                  className="sm:mr-auto"
                >
                  <WandSparklesIcon className="size-4" />
                  Resultados al azar
                </Button>
              )}
              {!isLastRound ? (
                <Button
                  size="lg"
                  disabled={!roundComplete || pozo.status === "warmup"}
                  onClick={handleNextRound}
                >
                  Siguiente ronda
                  <ArrowRightIcon className="size-4" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled={!roundComplete}
                  onClick={handleNextRound}
                >
                  Finalizar pozo
                  <Trophy className="size-4" />
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="standings" className="space-y-4">
          <StandingsTable standings={standings} matches={pozo.matches} />
        </TabsContent>
      </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  )
}

function PozoHeader({
  pozo,
  onFinish,
  showFinish,
  onChangeGroup,
}: {
  pozo: Pozo
  onFinish?: () => void
  showFinish?: boolean
  onChangeGroup?: (groupId: string | undefined) => void
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver" className="shrink-0">
          <Link to="/pozos">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Heading level="h1" className="break-words">{pozo.name}</Heading>
            <PozoStatusBadge status={pozo.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Text variant="muted">
              {pozo.players.length} jugadores · {pozo.config.courts} canchas ·{" "}
              {pozo.totalRounds} {pozo.totalRounds === 1 ? "ronda" : "rondas"}
            </Text>
            {onChangeGroup && (
              <>
                <span aria-hidden className="text-muted-foreground">·</span>
                <GroupBadge groupId={pozo.groupId} onChange={onChangeGroup} />
              </>
            )}
          </div>
        </div>
      </div>
      {showFinish && onFinish && (
        <Dialog>
          <DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
            <FlagIcon className="size-4" />
            <span className="hidden sm:inline">Finalizar</span>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Finalizar el pozo ahora?</DialogTitle>
              <DialogDescription>
                Vas a saltar al podio con los resultados cargados hasta el momento.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onFinish}>
                <Trophy className="size-4" />
                Sí, ver resultados
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PozoDraftView({
  pozo,
  onStart,
  onBack,
  onChangeGroup,
}: {
  pozo: Pozo
  onStart: () => void
  onBack: () => void
  onChangeGroup: (groupId: string | undefined) => void
}) {
  return (
    <PageContainer>
      <PozoHeader pozo={pozo} onChangeGroup={onChangeGroup} />
      <Card>
        <CardContent className="space-y-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">Tu pozo está listo para arrancar.</p>
          <div className="grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
            <Stat label="Calentamiento" value={`${pozo.config.warmupMin} min`} />
            <Stat label="Duración" value={`${pozo.config.totalDurationMin} min`} />
            <Stat label="Rondas" value={pozo.totalRounds} />
            <Stat label="Partidos" value={pozo.totalRounds * pozo.config.courts} />
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={onBack}>
              Volver
            </Button>
            <Button onClick={onStart}>
              <PlayIcon className="size-5" />
              Comenzar pozo
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function FinishedView({
  pozo,
  onBack,
  onChangeGroup,
}: {
  pozo: Pozo
  onBack: () => void
  onChangeGroup: (groupId: string | undefined) => void
}) {
  const navigate = useNavigate()
  // Memoized — `sortStandings` re-runs when sort changes and would otherwise
  // recompute `standings` from scratch every render (FinishedView re-renders
  // on the `setSort` flip and on every confetti effect tick).
  const standings = React.useMemo(
    () => computeStandings(pozo.players, pozo.matches),
    [pozo.players, pozo.matches],
  )
  // Sort is lifted here so the podium follows the user's choice in the table.
  const [sort, setSort] = React.useState<StandingsSort>("games")
  const podiumStandings = React.useMemo(
    () => sortStandings(standings, sort, pozo.matches),
    [standings, sort, pozo.matches],
  )
  const playerById = React.useMemo(
    () => new Map(pozo.players.map((p) => [p.id, p])),
    [pozo.players],
  )
  // Pre-group matches by round so the renderer below is O(N) instead of
  // O(rounds × matches). With 10 rounds × 40 matches the old code did 400
  // filter iterations every render; this builds the map once.
  const matchesByRound = React.useMemo(() => {
    const map = new Map<number, typeof pozo.matches>()
    for (const m of pozo.matches) {
      const list = map.get(m.round)
      if (list) list.push(m)
      else map.set(m.round, [m])
    }
    return map
  }, [pozo.matches])

  // Celebrate once when the FinishedView mounts. Idempotent per pozo via the
  // pozo id in the dep array — re-mounting the same pozo doesn't re-fire.
  React.useEffect(() => {
    let cancelled = false
    // Track timeouts at the effect scope (not inside .then()) so the cleanup
    // can actually clear them. The cleanup returned from a promise callback
    // is dropped by React, so any setTimeout queued inside .then() must be
    // mirrored here to be cancellable.
    const timeouts: number[] = []
    void import("canvas-confetti").then((mod) => {
      if (cancelled) return
      const confetti = mod.default
      // Two-burst pattern: one from the bottom-left, one from the bottom-right,
      // both angled upward toward the center. Synced with the podium animation
      // so confetti peaks as the 1st-place bar rises.
      const fire = (originX: number, angle: number) =>
        confetti({
          particleCount: 80,
          spread: 70,
          startVelocity: 55,
          origin: { x: originX, y: 0.85 },
          angle,
          ticks: 200,
          scalar: 0.9,
          colors: ["#fbbf24", "#a3a3a3", "#fb923c", "#6366f1", "#10b981"],
        })
      timeouts.push(
        window.setTimeout(() => fire(0.15, 60), 350),
        window.setTimeout(() => fire(0.85, 120), 500),
        window.setTimeout(() => fire(0.5, 90), 900),
      )
    })
    return () => {
      cancelled = true
      for (const id of timeouts) window.clearTimeout(id)
    }
  }, [pozo.id])

  return (
    <PageContainer>
      <PozoHeader pozo={pozo} onChangeGroup={onChangeGroup} />
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/10 to-transparent">
        <CardContent className="space-y-6 py-8">
          <div className="text-center">
            <Trophy className="mx-auto size-9 text-primary" />
            <Heading level="h3" as="h2" className="mt-2">Resultados finales</Heading>
            <Text variant="muted">
              {pozo.players.length} jugadores · {pozo.matches.filter((m) => m.gamesA !== null).length}{" "}
              partidos jugados
            </Text>
          </div>
          <Podium standings={podiumStandings} />
        </CardContent>
      </Card>

      <Tabs defaultValue="standings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="standings">Posiciones</TabsTrigger>
          <TabsTrigger value="matches">Partidos</TabsTrigger>
        </TabsList>
        <TabsContent value="standings">
          <StandingsTable
            standings={standings}
            matches={pozo.matches}
            sort={sort}
            onSortChange={setSort}
          />
        </TabsContent>
        <TabsContent value="matches" className="space-y-4">
          {Array.from({ length: pozo.totalRounds }).map((_, roundIndex) => {
            const matches = matchesByRound.get(roundIndex) ?? []
            if (matches.length === 0) return null
            return (
              <div key={roundIndex} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Ronda {roundIndex + 1}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      playerById={playerById}
                      onSubmit={() => undefined}
                      readOnly
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => navigate("/pozos/nuevo")}>
          <RotateCcwIcon className="size-4" />
          Crear otro pozo
        </Button>
        <Button onClick={onBack}>Volver a pozos</Button>
      </div>
    </PageContainer>
  )
}

function RoundProgress({ current, total }: { current: number; total: number }) {
  const pct = total === 0 ? 0 : ((current + 1) / total) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Ronda {current + 1} de {total}
        </span>
        <span className="tabular-nums">{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/**
 * Clickable badge that shows the pozo's current group (or "Sin grupo") and
 * opens a popover to change it. Lists the owner's existing groups + a "Sin
 * grupo" option to detach.
 */
function GroupBadge({
  groupId,
  onChange,
}: {
  groupId: string | undefined
  onChange: (groupId: string | undefined) => void
}) {
  const [open, setOpen] = React.useState(false)
  const { groups } = useGroups()
  const current = groupId ? groups.find((g) => g.id === groupId) : null

  function pick(nextId: string | undefined) {
    if (nextId === (groupId ?? undefined)) {
      setOpen(false)
      return
    }
    onChange(nextId)
    toast.success(nextId ? "Grupo actualizado" : "Pozo sin grupo")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Cambiar grupo"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          />
        }
      >
        <FolderIcon className="size-3" />
        <span className="truncate">{current?.name ?? "Sin grupo"}</span>
        <ChevronDownIcon className="size-3" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar grupo…" />
          <CommandList>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => pick(undefined)}>
                <span className="text-muted-foreground">Sin grupo</span>
                {!groupId && <CheckIcon className="ml-auto size-3.5" />}
              </CommandItem>
            </CommandGroup>
            {groups.length > 0 && <CommandSeparator />}
            {groups.length > 0 && (
              <CommandGroup heading="Tus grupos">
                {groups.map((g) => (
                  <CommandItem key={g.id} value={g.id} onSelect={() => pick(g.id)}>
                    <FolderIcon className="size-4 text-muted-foreground" />
                    <span className="truncate">{g.name}</span>
                    {groupId === g.id && <CheckIcon className="ml-auto size-3.5" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
