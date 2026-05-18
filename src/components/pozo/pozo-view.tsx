"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FlagIcon,
  PlayIcon,
  RotateCcwIcon,
  Trophy,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { MatchCard } from "@/components/pozo/match-card"
import { Podium } from "@/components/pozo/podium"
import { PozoStatusBadge } from "@/components/pozo/status-badge"
import { PozoTimer } from "@/components/pozo/pozo-timer"
import { StandingsTable } from "@/components/pozo/standings-table"
import { useNow } from "@/hooks/use-now"
import {
  advanceRound,
  beginPlay,
  finishPozo,
  getCurrentMatches,
  isRoundComplete,
  recordMatchResult,
  startPozo,
} from "@/lib/pozo/factory"
import { computeStandings, sortStandings } from "@/lib/pozo/standings"
import type { Pozo } from "@/lib/pozo/types"

type UpdaterFn = (current: Pozo) => Pozo

type Props = {
  pozo: Pozo
  onUpdate: (updater: UpdaterFn) => void
}

export function PozoView({ pozo, onUpdate }: Props) {
  const router = useRouter()
  const now = useNow(1000)
  const playerById = React.useMemo(
    () => new Map(pozo.players.map((p) => [p.id, p])),
    [pozo.players],
  )
  const currentMatches = getCurrentMatches(pozo)
  const roundComplete = isRoundComplete(pozo)
  const standings = React.useMemo(
    () => computeStandings(pozo.players, pozo.matches),
    [pozo.players, pozo.matches],
  )
  const isLastRound = pozo.currentRound + 1 >= pozo.totalRounds
  const allRoundsComplete = isLastRound && roundComplete

  if (pozo.status === "draft") {
    return (
      <PozoDraftView
        pozo={pozo}
        onStart={() => onUpdate((p) => startPozo(p))}
        onBack={() => router.push("/pozos")}
      />
    )
  }

  if (pozo.status === "finished") {
    return (
      <FinishedView
        pozo={pozo}
        onBack={() => router.push("/pozos")}
      />
    )
  }

  const warmupActive = pozo.status === "warmup" && pozo.warmupEndsAt !== null
  const warmupEndsAt = pozo.warmupEndsAt ?? 0
  const endsAt = pozo.endsAt ?? 0

  function recordResult(matchId: string, gamesA: number, gamesB: number) {
    onUpdate((p) => recordMatchResult(p, matchId, gamesA, gamesB))
    toast.success("Resultado guardado")
  }

  function handleNextRound() {
    onUpdate((p) => advanceRound(p))
    if (isLastRound) toast.success("¡Pozo finalizado!")
    else toast.success("Siguiente ronda lista")
  }

  function handleFinishEarly() {
    onUpdate((p) => finishPozo(p))
    toast.success("Pozo cerrado")
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PozoHeader pozo={pozo} onFinish={handleFinishEarly} showFinish />

      {warmupActive ? (
        <div className="space-y-4">
          <PozoTimer
            label="Calentamiento"
            endsAt={warmupEndsAt}
            now={now}
            variant="warmup"
          />
          <Button size="lg" onClick={() => onUpdate((p) => beginPlay(p))} className="w-full">
            <PlayIcon className="size-5" />
            Empezar a jugar
          </Button>
        </div>
      ) : (
        <PozoTimer label="Pozo en juego" endsAt={endsAt} now={now} />
      )}

      <Tabs defaultValue="matches" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="matches">
            Ronda {pozo.currentRound + 1} / {pozo.totalRounds}
          </TabsTrigger>
          <TabsTrigger value="standings">Posiciones</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-4">
          <RoundProgress current={pozo.currentRound} total={pozo.totalRounds} />
          <div className="grid gap-4 sm:grid-cols-2">
            {currentMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                playerById={playerById}
                onSubmit={recordResult}
                readOnly={pozo.status !== "playing" && pozo.status !== "warmup"}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
        </TabsContent>

        <TabsContent value="standings" className="space-y-4">
          <StandingsTable standings={standings} />
        </TabsContent>
      </Tabs>

      {allRoundsComplete && (
        <Card className="bg-primary/5">
          <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Última ronda jugada. ¿Cerrar el pozo y ver el podio?
            </p>
            <Button onClick={handleFinishEarly}>
              <Trophy className="size-4" />
              Ver resultados finales
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PozoHeader({
  pozo,
  onFinish,
  showFinish,
}: {
  pozo: Pozo
  onFinish?: () => void
  showFinish?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href="/pozos">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{pozo.name}</h1>
            <PozoStatusBadge status={pozo.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {pozo.players.length} jugadores · {pozo.config.courts} canchas ·{" "}
            {pozo.totalRounds} {pozo.totalRounds === 1 ? "ronda" : "rondas"}
          </p>
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
}: {
  pozo: Pozo
  onStart: () => void
  onBack: () => void
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <PozoHeader pozo={pozo} />
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
            <Button size="lg" onClick={onStart}>
              <PlayIcon className="size-5" />
              Comenzar pozo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FinishedView({ pozo, onBack }: { pozo: Pozo; onBack: () => void }) {
  const router = useRouter()
  const standings = computeStandings(pozo.players, pozo.matches)
  const podiumStandings = sortStandings(standings, "games")
  const playerById = React.useMemo(
    () => new Map(pozo.players.map((p) => [p.id, p])),
    [pozo.players],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PozoHeader pozo={pozo} />
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/10 to-transparent">
        <CardContent className="space-y-6 py-8">
          <div className="text-center">
            <Trophy className="mx-auto size-9 text-primary" />
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">Resultados finales</h2>
            <p className="text-sm text-muted-foreground">
              {pozo.players.length} jugadores · {pozo.matches.filter((m) => m.gamesA !== null).length}{" "}
              partidos jugados
            </p>
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
          <StandingsTable standings={standings} />
        </TabsContent>
        <TabsContent value="matches" className="space-y-4">
          {Array.from({ length: pozo.totalRounds }).map((_, roundIndex) => {
            const matches = pozo.matches.filter((m) => m.round === roundIndex)
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
        <Button variant="outline" onClick={() => router.push("/pozos/nuevo")}>
          <RotateCcwIcon className="size-4" />
          Crear otro pozo
        </Button>
        <Button onClick={onBack}>Volver a pozos</Button>
      </div>
    </div>
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
