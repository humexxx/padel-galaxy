import * as React from "react"
import { doc, collection } from "firebase/firestore"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { Textarea } from "@/components/ui/textarea"
import { PlayerCombobox, type PlayerSelection } from "@/components/pozo/player-combobox"
import { useAuth } from "@/contexts/auth-context"
import { usePlayers } from "@/hooks/use-players"
import {
  CADENCE_OPTIONS,
  DEFAULT_DURATION_MIN,
  DURATION_OPTIONS,
  MAX_STUDENTS,
  PACKAGE_OPTIONS,
  SESSIONS_BY_PACKAGE,
  buildSessionStarts,
  createClassPackage,
  dateInputValue,
  defaultClassStart,
  formatShortDate,
  timeInputValue,
  toTimestamp,
  updateClass,
  type ClassCadence,
  type ClassPackageType,
  type ClassRecord,
  type ClassStudent,
} from "@/lib/classes"
import { db } from "@/lib/firebase"
import { createPlayer, findPlayerByName, normalizeName } from "@/lib/players"
import { cn } from "@/lib/utils"

const STUDENT_COUNTS = [1, 2, 3, 4] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit that single session. Absent = book a new package. */
  editing?: ClassRecord | null
}

function emptySlot(): PlayerSelection {
  return { id: null, name: "" }
}

export function ClassForm({ open, onOpenChange, editing }: Props) {
  const { user } = useAuth()
  const { players: roster } = usePlayers()
  const isEdit = Boolean(editing)

  const [slots, setSlots] = React.useState<PlayerSelection[]>([emptySlot()])
  const [packageType, setPackageType] =
    React.useState<ClassPackageType>("individual")
  const [cadence, setCadence] = React.useState<ClassCadence>("weekly")
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [durationMin, setDurationMin] = React.useState(DEFAULT_DURATION_MIN)
  const [location, setLocation] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // Reset to a clean slate (or to the edited class) every time the form is
  // opened, so a cancelled draft never leaks into the next booking.
  React.useEffect(() => {
    if (!open) return
    const base = editing?.startsAt ?? defaultClassStart()
    setDate(dateInputValue(base))
    setTime(timeInputValue(base))
    setDurationMin(editing?.durationMin ?? DEFAULT_DURATION_MIN)
    setSlots(
      editing
        ? editing.students.map((s) => ({ id: s.id, name: s.name }))
        : [emptySlot()],
    )
    setPackageType(editing?.packageType ?? "individual")
    setCadence("weekly")
    setLocation(editing?.location ?? "")
    setNotes(editing?.notes ?? "")
  }, [open, editing])

  const startsAt = toTimestamp(date, time)
  const sessionCount = SESSIONS_BY_PACKAGE[packageType]
  // Only new bookings lay out sessions — editing touches this class alone.
  const sessionStarts = React.useMemo(
    () =>
      isEdit || Number.isNaN(startsAt)
        ? []
        : buildSessionStarts(startsAt, sessionCount, cadence),
    [isEdit, startsAt, sessionCount, cadence],
  )

  const pickedIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const s of slots) if (s.id) ids.add(s.id)
    return ids
  }, [slots])

  const errors = React.useMemo(() => {
    const out: string[] = []
    const named = slots.filter((s) => s.name.trim().length > 0)
    if (named.length !== slots.length) out.push("Faltan alumnos por elegir.")
    const keys = named.map((s) => normalizeName(s.name))
    if (new Set(keys).size !== keys.length)
      out.push("Hay un alumno repetido en la clase.")
    if (Number.isNaN(startsAt)) out.push("Elegí una fecha y una hora.")
    return out
  }, [slots, startsAt])

  function setStudentCount(count: number) {
    setSlots((curr) => {
      if (count === curr.length) return curr
      if (count < curr.length) return curr.slice(0, count)
      return [
        ...curr,
        ...Array.from({ length: count - curr.length }, emptySlot),
      ]
    })
  }

  function updateSlot(index: number, next: PlayerSelection) {
    setSlots((curr) => curr.map((s, i) => (i === index ? next : s)))
  }

  /** Turn each slot into a real /players record, creating the ones the
   *  organizer typed fresh. Same resolution the pozo form does. */
  async function resolveStudents(ownerId: string): Promise<ClassStudent[]> {
    return Promise.all(
      slots.map(async (slot) => {
        const name = slot.name.trim()
        if (slot.id) return { id: slot.id, name }
        const existing = findPlayerByName(roster, name)
        if (existing) return { id: existing.id, name: existing.name }
        const id = doc(collection(db, "players")).id
        await createPlayer({ id, ownerId, name })
        return { id, name }
      }),
    )
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
    setSaving(true)
    try {
      const students = await resolveStudents(user.uid)
      if (editing) {
        await updateClass(editing.id, {
          startsAt,
          durationMin,
          students,
          location: location.trim() || null,
          notes: notes.trim() || null,
        })
        toast.success("Clase actualizada")
      } else {
        await createClassPackage({
          ownerId: user.uid,
          students,
          packageType,
          firstStartsAt: startsAt,
          durationMin,
          cadence,
          location,
          notes,
        })
        toast.success(
          sessionCount === 1
            ? "Clase agendada"
            : `${sessionCount} clases agendadas`,
        )
      }
      onOpenChange(false)
    } catch (err) {
      console.error("Error saving class:", err)
      toast.error(
        editing ? "No se pudo guardar la clase" : "No se pudo agendar la clase",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={saving ? () => {} : onOpenChange}
      title={isEdit ? "Editar clase" : "Agendar clase"}
      description={
        isEdit
          ? "Los cambios aplican solo a esta clase del paquete."
          : "Elegí los alumnos, el paquete y cuándo arranca."
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="class-form"
            className="h-11 sm:h-9"
            disabled={saving || errors.length > 0}
          >
            {saving
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : sessionCount === 1
                  ? "Agendar clase"
                  : `Agendar ${sessionCount} clases`}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel>Cantidad de alumnos</FieldLabel>
            <ChoiceRow
              options={STUDENT_COUNTS.map((n) => ({
                value: n,
                label: String(n),
              }))}
              value={slots.length}
              onChange={setStudentCount}
              ariaLabel="Cantidad de alumnos"
              disabled={saving}
            />
            <FieldDescription>
              Hasta {MAX_STUDENTS} alumnos por clase.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>{slots.length > 1 ? "Alumnos" : "Alumno"}</FieldLabel>
            <div className="space-y-2">
              {slots.map((slot, i) => (
                <PlayerCombobox
                  key={i}
                  value={slot}
                  onChange={(next) => updateSlot(i, next)}
                  players={roster}
                  excludeIds={pickedIds}
                  label={
                    slots.length > 1 ? `Alumno ${i + 1}` : "Alumno de la clase"
                  }
                  placeholder="Buscar o crear…"
                  disabled={saving}
                />
              ))}
            </div>
          </Field>

          {!isEdit && (
            <Field>
              <FieldLabel>Paquete</FieldLabel>
              <ChoiceRow
                options={PACKAGE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                  hint: o.description,
                }))}
                value={packageType}
                onChange={setPackageType}
                ariaLabel="Paquete de clases"
                disabled={saving}
                stacked
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="class-date">Fecha</FieldLabel>
              <Input
                id="class-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 sm:h-9"
                required
                disabled={saving}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="class-time">Hora</FieldLabel>
              <Input
                id="class-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 sm:h-9"
                required
                disabled={saving}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Duración</FieldLabel>
            <ChoiceRow
              options={DURATION_OPTIONS.map((m) => ({
                value: m,
                label: `${m} min`,
              }))}
              value={durationMin}
              onChange={setDurationMin}
              ariaLabel="Duración de la clase"
              disabled={saving}
            />
          </Field>

          {!isEdit && sessionCount > 1 && (
            <Field>
              <FieldLabel>Repetir</FieldLabel>
              <ChoiceRow
                options={CADENCE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={cadence}
                onChange={setCadence}
                ariaLabel="Frecuencia del paquete"
                disabled={saving}
                stacked
              />
              {sessionStarts.length > 0 && (
                <FieldDescription>
                  Se agendan {sessionStarts.length} clases:{" "}
                  {sessionStarts.map(formatShortDate).join(" · ")}
                </FieldDescription>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="class-location">Lugar (opcional)</FieldLabel>
            <Input
              id="class-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Cancha 2"
              className="h-11 sm:h-9"
              disabled={saving}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="class-notes">Notas (opcional)</FieldLabel>
            <Textarea
              id="class-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trabajar volea y bandeja"
              rows={2}
              disabled={saving}
            />
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  )
}

type Choice<T> = { value: T; label: string; hint?: string }

/**
 * Segmented control. Beats a `<select>` for short option sets on a phone:
 * every choice is visible and each target is a 44 px tap, so the organizer
 * can set up a class without a single dropdown round-trip.
 */
function ChoiceRow<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  stacked,
}: {
  options: Choice<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
  disabled?: boolean
  /** Two lines per option (label + hint) instead of a single row. */
  stacked?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid gap-2",
        options.length === 2 && "grid-cols-2",
        options.length === 3 && "grid-cols-3",
        options.length === 4 && "grid-cols-4",
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className={cn(stacked ? "text-[13px] leading-tight" : "")}>
              {option.label}
            </span>
            {option.hint && (
              <span className="text-[11px] font-normal opacity-70">
                {option.hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
