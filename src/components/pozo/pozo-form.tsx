import * as React from "react"
import { useNavigate } from "react-router"
import {
  ArrowLeftIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  WandSparklesIcon,
} from "lucide-react"
import { doc, collection } from "firebase/firestore"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Heading, Text } from "@/components/ui/typography"
import { GroupCombobox, type GroupSelection } from "@/components/pozo/group-combobox"
import { PlayerCombobox, type PlayerSelection } from "@/components/pozo/player-combobox"
import { useAuth } from "@/contexts/auth-context"
import { useGroups } from "@/hooks/use-groups"
import { usePlayers } from "@/hooks/use-players"
import { db } from "@/lib/firebase"
import { createGroup, findGroupByName } from "@/lib/groups"
import { createPlayer, findPlayerByName, normalizeName } from "@/lib/players"
import { computeTotalRounds, defaultMatchesPerPlayer } from "@/lib/pozo/algorithms"
import { DEFAULT_CONFIG, createPozo, computeMatchDurationMin } from "@/lib/pozo/factory"
import { savePozo } from "@/lib/storage"
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

const MIN_PLAYERS = 8
const MIN_COURTS = 2

function emptySlot(): PlayerSelection {
  return { id: null, name: "" }
}

function defaultSlots(courts: number): PlayerSelection[] {
  const count = Math.max(MIN_PLAYERS, courts * 4)
  return Array.from({ length: count }, emptySlot)
}

export function PozoForm() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { players: roster } = usePlayers()
  const { groups: groupRoster } = useGroups()
  const [name, setName] = React.useState(() => {
    const d = new Date()
    return `Pozo ${d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`
  })
  const [groupSel, setGroupSel] = React.useState<GroupSelection>({ id: null, name: "" })
  const [courts, setCourts] = React.useState<number>(DEFAULT_CONFIG.courts)
  const [slots, setSlots] = React.useState<PlayerSelection[]>(() =>
    defaultSlots(DEFAULT_CONFIG.courts),
  )
  const [matchesOverride, setMatchesOverride] = React.useState<number | null>(null)
  const [totalDurationMin, setTotalDurationMin] = React.useState<number>(DEFAULT_CONFIG.totalDurationMin)
  const [warmupMin, setWarmupMin] = React.useState<number>(DEFAULT_CONFIG.warmupMin)
  const [warmupIncluded, setWarmupIncluded] = React.useState<boolean>(
    DEFAULT_CONFIG.warmupIncludedInTotal ?? true,
  )
  const [algorithm, setAlgorithm] = React.useState<PairingAlgorithm>(DEFAULT_CONFIG.algorithm)
  const [allowRepeatPairs, setAllowRepeatPairs] = React.useState<boolean>(DEFAULT_CONFIG.allowRepeatPairs)
  const [submitting, setSubmitting] = React.useState(false)

  // Slots that have a name filled in (existing or new). Memoized so the
  // dependent derivations below don't recompute on unrelated re-renders.
  const filledSlots = React.useMemo(
    () => slots.filter((s) => s.name.trim().length > 0),
    [slots],
  )
  // IDs already chosen in other slots — passed to each combobox so users can't
  // pick the same person twice.
  const pickedIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const s of slots) if (s.id) ids.add(s.id)
    return ids
  }, [slots])

  // Use the expected-when-full count (courts × 4) until the form has real
  // players filled in — otherwise the default shows 0 on the empty form.
  const effectivePlayerCount = filledSlots.length || courts * 4
  const defaultMatches = defaultMatchesPerPlayer(effectivePlayerCount, courts)
  const matchesPerPlayer = matchesOverride ?? defaultMatches
  const totalRounds = computeTotalRounds(filledSlots.length, courts, matchesPerPlayer)
  const matchDurationMin = computeMatchDurationMin(
    { ...DEFAULT_CONFIG, totalDurationMin, warmupMin, warmupIncludedInTotal: warmupIncluded, courts, matchesPerPlayer, algorithm, allowRepeatPairs },
    totalRounds,
  )

  // Validate the form on each render but memoize so we only re-validate when
  // an actual input changes (instead of every keystroke in any sibling field).
  const errors = React.useMemo(() => {
    const out: string[] = []
    if (filledSlots.length < MIN_PLAYERS)
      out.push(`Necesitás al menos ${MIN_PLAYERS} jugadores.`)
    if (filledSlots.length < courts * 4)
      out.push(`Para ${courts} canchas necesitás al menos ${courts * 4} jugadores.`)
    const normalizedNames = filledSlots.map((s) => normalizeName(s.name))
    if (new Set(normalizedNames).size !== normalizedNames.length)
      out.push("Hay nombres de jugadores repetidos.")
    if (matchesPerPlayer < 1)
      out.push("La cantidad de partidos debe ser al menos 1.")
    if (warmupIncluded && warmupMin >= totalDurationMin)
      out.push("La duración total debe ser mayor al tiempo de calentamiento.")
    return out
  }, [
    filledSlots,
    courts,
    matchesPerPlayer,
    warmupIncluded,
    warmupMin,
    totalDurationMin,
  ])

  function setCourtsAndAdjustPlayers(newCourts: number) {
    setCourts(newCourts)
    const minSlots = newCourts * 4
    setSlots((curr) => {
      if (curr.length >= minSlots) return curr
      return [
        ...curr,
        ...Array.from({ length: minSlots - curr.length }, emptySlot),
      ]
    })
  }

  function addSlot() {
    setSlots((curr) => [...curr, emptySlot()])
  }

  function removeSlot(index: number) {
    setSlots((curr) => curr.filter((_, i) => i !== index))
  }

  function updateSlot(index: number, next: PlayerSelection) {
    setSlots((curr) => curr.map((s, i) => (i === index ? next : s)))
  }

  /**
   * Admin shortcut: fill any empty slots with placeholder names. If the
   * generated name matches a player that already exists in the roster, link
   * to that player's id so the slot is rendered as "existing" (no NUEVO
   * badge). Idempotent on already-filled slots.
   */
  function autoFillPlayers() {
    setSlots((curr) => {
      const usedLower = new Set(
        curr
          .map((s) => normalizeName(s.name))
          .filter((n) => n.length > 0),
      )
      let counter = 1
      return curr.map((slot) => {
        if (slot.name.trim().length > 0) return slot
        let candidate = `Test ${counter++}`
        while (usedLower.has(normalizeName(candidate))) {
          candidate = `Test ${counter++}`
        }
        usedLower.add(normalizeName(candidate))
        // If "Test N" is already a saved player in this owner's roster,
        // reuse its id so the form treats the slot as a normal pick (no
        // NUEVO badge, no second createPlayer at submit time).
        const existing = findPlayerByName(roster, candidate)
        if (existing) return { id: existing.id, name: existing.name }
        return { id: null, name: candidate }
      })
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }
    if (!user) {
      toast.error("Tenés que iniciar sesión")
      return
    }
    setSubmitting(true)
    try {
      // Resolve the group (optional). Empty → no group. Existing pick →
      // reuse id. Typed-new but already-exists by normalized name → reuse.
      // Otherwise create fresh.
      let groupId: string | undefined = groupSel.id ?? undefined
      if (!groupId && groupSel.name.trim()) {
        const existingGroup = findGroupByName(groupRoster, groupSel.name)
        if (existingGroup) {
          groupId = existingGroup.id
        } else {
          const newGroupId = doc(collection(db, "groups")).id
          await createGroup({ id: newGroupId, ownerId: user.uid, name: groupSel.name })
          groupId = newGroupId
        }
      }

      // Resolve every slot to a real Firestore player id, either by reusing
      // an existing record (matched by id OR by normalized name fallback)
      // or by creating a fresh player document on the fly.
      const resolved = await Promise.all(
        filledSlots.map(async (slot) => {
          if (slot.id) return { id: slot.id, name: slot.name.trim() }
          const existing = findPlayerByName(roster, slot.name)
          if (existing) return { id: existing.id, name: existing.name }
          const newId = doc(collection(db, "players")).id
          await createPlayer({ id: newId, ownerId: user.uid, name: slot.name })
          return { id: newId, name: slot.name.trim() }
        }),
      )

      const pozo = createPozo({
        name,
        players: resolved,
        ownerId: user.uid,
        groupId,
        config: {
          courts,
          matchesPerPlayer,
          totalDurationMin,
          warmupMin,
          warmupIncludedInTotal: warmupIncluded,
          algorithm,
          allowRepeatPairs,
        },
      })
      await savePozo(pozo)
      toast.success("Pozo creado")
      navigate(`/pozos/${pozo.id}`)
    } catch (err) {
      console.error(err)
      toast.error("No se pudo guardar el pozo")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div>
          <Heading level="h1">Nuevo pozo</Heading>
          <Text variant="muted">Configurá los detalles y empezá a jugar.</Text>
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
            <Field>
              <FieldLabel>Grupo (opcional)</FieldLabel>
              <GroupCombobox
                value={groupSel}
                onChange={setGroupSel}
                groups={groupRoster}
                label="Grupo del pozo"
                disabled={submitting}
              />
              <FieldDescription>
                Los pozos del mismo grupo comparten estadísticas. Lo podés
                cambiar después desde el detalle del pozo.
              </FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="courts">Cantidad de canchas</FieldLabel>
                <Input
                  id="courts"
                  type="number"
                  min={MIN_COURTS}
                  max={8}
                  inputMode="numeric"
                  value={courts}
                  onChange={(e) =>
                    setCourtsAndAdjustPlayers(
                      Math.max(MIN_COURTS, Number(e.target.value) || MIN_COURTS),
                    )
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="matches">Partidos por jugador</FieldLabel>
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
                  Default: <code className="font-mono">{defaultMatches}</code>{" "}
                  (cada uno juega con cada uno).
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jugadores</CardTitle>
          <CardDescription>
            {filledSlots.length} jugadores · necesitás {courts * 4} para llenar las canchas
          </CardDescription>
          {isAdmin && (
            <CardAction>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={autoFillPlayers}
                title="Rellenar slots vacíos con nombres de prueba (admin)"
              >
                <WandSparklesIcon className="size-4" />
                <span className="hidden sm:inline">Auto-rellenar</span>
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {slots.map((slot, i) => {
              // Exclude IDs picked in OTHER slots, but allow the current
              // slot's own id to remain pickable. We re-use the parent
              // `pickedIds` Set and just delete this slot's id locally if
              // present — the cost is O(1) vs `new Set(pickedIds)` per slot
              // per render (was N×M with empty pozos).
              const exclude = slot.id && pickedIds.has(slot.id)
                ? new Set([...pickedIds].filter((id) => id !== slot.id))
                : pickedIds
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <PlayerCombobox
                      value={slot}
                      onChange={(next) => updateSlot(i, next)}
                      players={roster}
                      excludeIds={exclude}
                      placeholder={`Jugador ${i + 1}`}
                      label={`Jugador ${i + 1}`}
                      disabled={submitting}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    onClick={() => removeSlot(i)}
                    aria-label={`Quitar jugador ${i + 1}`}
                    disabled={slots.length <= MIN_PLAYERS || submitting}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addSlot}
            className="mt-3 w-full"
          >
            <PlusIcon className="size-4" />
            Agregar jugador
          </Button>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <UsersIcon className="size-3.5" /> Mínimo {MIN_PLAYERS} jugadores. Buscalos en el roster
            o creá uno nuevo escribiendo el nombre. Los resultados quedan vinculados a cada persona.
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
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="warmup-included">Calentamiento incluido en el tiempo total</Label>
                <p className="text-xs text-muted-foreground">
                  {warmupIncluded
                    ? `El calentamiento ocupa los primeros ${warmupMin} min de los ${totalDurationMin} min totales.`
                    : `El calentamiento se agrega aparte (${warmupMin + totalDurationMin} min en total).`}
                </p>
              </div>
              <Switch
                id="warmup-included"
                checked={warmupIncluded}
                onCheckedChange={setWarmupIncluded}
              />
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={errors.length > 0 || submitting} size="lg">
          {submitting ? "Creando…" : "Crear pozo"}
        </Button>
      </div>
    </form>
  )
}
