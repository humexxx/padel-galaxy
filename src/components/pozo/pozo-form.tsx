"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { computeTotalRounds, defaultMatchesPerPlayer } from "@/lib/pozo/algorithms"
import { DEFAULT_CONFIG, createPozo, computeMatchDurationMin } from "@/lib/pozo/factory"
import { pozoStorage, emitPozosUpdated } from "@/lib/storage"
import type { PairingAlgorithm } from "@/lib/pozo/types"

const ALGORITHM_OPTIONS: { value: PairingAlgorithm; label: string; description: string }[] = [
  {
    value: "balanced",
    label: "Balanceado",
    description: "Empareja a los que ganan contra los que ganan para nivelar.",
  },
  {
    value: "random",
    label: "Aleatorio",
    description: "Siempre al azar — clásico pozo.",
  },
  {
    value: "snake",
    label: "Snake",
    description: "El más fuerte con el más débil. Equipos equilibrados.",
  },
]

const MIN_PLAYERS = 4

function defaultPlayerNames(courts: number): string[] {
  const count = Math.max(MIN_PLAYERS, courts * 4)
  return Array.from({ length: count }, (_, i) => `Jugador ${i + 1}`)
}

export function PozoForm() {
  const router = useRouter()
  const [name, setName] = React.useState(() => {
    const d = new Date()
    return `Pozo ${d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`
  })
  const [courts, setCourts] = React.useState<number>(DEFAULT_CONFIG.courts)
  const [players, setPlayers] = React.useState<string[]>(() =>
    defaultPlayerNames(DEFAULT_CONFIG.courts),
  )
  const [matchesOverride, setMatchesOverride] = React.useState<number | null>(null)
  const [totalDurationMin, setTotalDurationMin] = React.useState<number>(DEFAULT_CONFIG.totalDurationMin)
  const [warmupMin, setWarmupMin] = React.useState<number>(DEFAULT_CONFIG.warmupMin)
  const [algorithm, setAlgorithm] = React.useState<PairingAlgorithm>(DEFAULT_CONFIG.algorithm)
  const [allowRepeatPairs, setAllowRepeatPairs] = React.useState<boolean>(DEFAULT_CONFIG.allowRepeatPairs)

  const validPlayers = players.map((p) => p.trim()).filter(Boolean)
  const matchesPerPlayer =
    matchesOverride ?? defaultMatchesPerPlayer(validPlayers.length || courts * 4, courts)
  const totalRounds = computeTotalRounds(validPlayers.length, courts, matchesPerPlayer)
  const matchDurationMin = computeMatchDurationMin(
    { ...DEFAULT_CONFIG, totalDurationMin, warmupMin, courts, matchesPerPlayer, algorithm, allowRepeatPairs },
    totalRounds,
  )

  const errors: string[] = []
  if (validPlayers.length < MIN_PLAYERS) errors.push(`Necesitás al menos ${MIN_PLAYERS} jugadores.`)
  if (validPlayers.length < courts * 4)
    errors.push(`Para ${courts} canchas necesitás al menos ${courts * 4} jugadores.`)
  if (new Set(validPlayers.map((n) => n.toLowerCase())).size !== validPlayers.length)
    errors.push("Hay nombres de jugadores repetidos.")
  if (matchesPerPlayer < 1) errors.push("La cantidad de partidos debe ser al menos 1.")
  if (warmupMin >= totalDurationMin)
    errors.push("La duración total debe ser mayor al tiempo de calentamiento.")

  function setCourtsAndAdjustPlayers(newCourts: number) {
    setCourts(newCourts)
    const minPlayers = newCourts * 4
    if (players.length < minPlayers) {
      setPlayers((curr) => [
        ...curr,
        ...Array.from({ length: minPlayers - curr.length }, (_, i) => `Jugador ${curr.length + i + 1}`),
      ])
    }
  }

  function addPlayer() {
    setPlayers((curr) => [...curr, `Jugador ${curr.length + 1}`])
  }

  function removePlayer(index: number) {
    setPlayers((curr) => curr.filter((_, i) => i !== index))
  }

  function updatePlayer(index: number, value: string) {
    setPlayers((curr) => curr.map((p, i) => (i === index ? value : p)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }
    const pozo = createPozo({
      name,
      players: validPlayers,
      config: {
        courts,
        matchesPerPlayer,
        totalDurationMin,
        warmupMin,
        algorithm,
        allowRepeatPairs,
      },
    })
    pozoStorage.save(pozo)
    emitPozosUpdated()
    toast.success("Pozo creado")
    router.push(`/pozos/${pozo.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} aria-label="Volver">
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo pozo</h1>
          <p className="text-sm text-muted-foreground">Configurá los detalles y empezá a jugar.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
          <CardDescription>Información básica del pozo.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pozo del finde"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="courts">Cantidad de canchas</FieldLabel>
                <Input
                  id="courts"
                  type="number"
                  min={1}
                  max={8}
                  inputMode="numeric"
                  value={courts}
                  onChange={(e) => setCourtsAndAdjustPlayers(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="matches">
                  Partidos por jugador
                </FieldLabel>
                <Input
                  id="matches"
                  type="number"
                  min={1}
                  max={50}
                  inputMode="numeric"
                  value={matchesPerPlayer}
                  onChange={(e) =>
                    setMatchesOverride(Math.max(1, Number(e.target.value) || 1))
                  }
                />
                <FieldDescription>
                  Default: <code className="font-mono">{defaultMatchesPerPlayer(validPlayers.length, courts)}</code>{" "}
                  (cada uno juega con cada uno).
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Jugadores</CardTitle>
            <CardDescription>
              {validPlayers.length} jugadores · necesitás {courts * 4} para llenar las canchas
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addPlayer}>
            <PlusIcon className="size-4" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <Input
                  value={p}
                  onChange={(e) => updatePlayer(i, e.target.value)}
                  placeholder={`Jugador ${i + 1}`}
                  className="h-9"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9"
                  onClick={() => removePlayer(i)}
                  aria-label={`Quitar ${p || `jugador ${i + 1}`}`}
                  disabled={players.length <= MIN_PLAYERS}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <UsersIcon className="size-3.5" /> Mínimo {MIN_PLAYERS} jugadores. Si hay más que {courts * 4}, descansan
            rotando.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiempo</CardTitle>
          <CardDescription>El tiempo por partido se calcula automáticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="duration">Duración total (min)</FieldLabel>
                <Input
                  id="duration"
                  type="number"
                  min={15}
                  max={480}
                  inputMode="numeric"
                  value={totalDurationMin}
                  onChange={(e) => setTotalDurationMin(Math.max(15, Number(e.target.value) || 15))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="warmup">Calentamiento (min)</FieldLabel>
                <Input
                  id="warmup"
                  type="number"
                  min={0}
                  max={60}
                  inputMode="numeric"
                  value={warmupMin}
                  onChange={(e) => setWarmupMin(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
            </div>
            <div className="rounded-lg bg-muted/60 p-4 text-sm">
              <p className="text-muted-foreground">Tiempo estimado por partido</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {matchDurationMin > 0 ? `${matchDurationMin.toFixed(1)} min` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {totalRounds} {totalRounds === 1 ? "ronda" : "rondas"} ·{" "}
                {totalRounds * courts} {totalRounds * courts === 1 ? "partido" : "partidos"} totales
              </p>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emparejamientos</CardTitle>
          <CardDescription>Cómo se arman los partidos siguientes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Algoritmo</Label>
            <Select
              value={algorithm}
              onValueChange={(v) => {
                if (v) setAlgorithm(v as PairingAlgorithm)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) =>
                    ALGORITHM_OPTIONS.find((o) => o.value === value)?.label ?? "Elegir…"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALGORITHM_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ALGORITHM_OPTIONS.find((o) => o.value === algorithm)?.description}
            </p>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="repeat">Repetir parejas</Label>
              <p className="text-xs text-muted-foreground">
                Si está apagado, el algoritmo intenta que nadie repita compañero/a.
              </p>
            </div>
            <Switch id="repeat" checked={allowRepeatPairs} onCheckedChange={setAllowRepeatPairs} />
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <ul className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={errors.length > 0} size="lg">
          Crear pozo
        </Button>
      </div>
    </form>
  )
}
