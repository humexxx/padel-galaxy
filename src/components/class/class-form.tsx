import * as React from "react"
import { XIcon } from "lucide-react"
import { doc, collection } from "firebase/firestore"
import { es } from "react-day-picker/locale"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PlayerCombobox, type PlayerSelection } from "@/components/pozo/player-combobox"
import { useAuth } from "@/contexts/auth-context"
import { usePlayers } from "@/hooks/use-players"
import {
  CLASS_TIME_OPTIONS,
  MAX_STUDENTS,
  PACKAGE_OPTIONS,
  SESSIONS_BY_PACKAGE,
  createClassPackage,
  dateFromInputValue,
  dateInputValue,
  defaultClassStart,
  formatDayHeading,
  mergeSessionDays,
  sessionStartsFromDays,
  timeInputValue,
  updateClass,
  type ClassPackageType,
  type ClassRecord,
  type ClassStudent,
  type SessionDay,
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

/** The next full hour, snapped to the pick-list; 18:00 when it isn't on it. */
function suggestedTime(): string {
  const t = timeInputValue(defaultClassStart())
  return CLASS_TIME_OPTIONS.includes(t) ? t : "18:00"
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function ClassForm({ open, onOpenChange, editing }: Props) {
  const { user } = useAuth()
  const { players: roster } = usePlayers()
  const isEdit = Boolean(editing)

  const [slots, setSlots] = React.useState<PlayerSelection[]>([emptySlot()])
  const [packageType, setPackageType] =
    React.useState<ClassPackageType>("individual")
  const [days, setDays] = React.useState<SessionDay[]>([])
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // Reset to a clean slate (or to the edited class) every time the form is
  // opened, so a cancelled draft never leaks into the next booking.
  React.useEffect(() => {
    if (!open) return
    setSlots(
      editing
        ? editing.students.map((s) => ({ id: s.id, name: s.name }))
        : [emptySlot()],
    )
    setPackageType(editing?.packageType ?? "individual")
    setDays(
      editing
        ? [
            {
              date: dateInputValue(editing.startsAt),
              time: timeInputValue(editing.startsAt),
            },
          ]
        : [],
    )
    setNotes(editing?.notes ?? "")
  }, [open, editing])

  // Editing touches one session; a new booking needs one day per session.
  const sessionCount = isEdit ? 1 : SESSIONS_BY_PACKAGE[packageType]
  const remaining = sessionCount - days.length

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
    if (days.length !== sessionCount)
      out.push(
        sessionCount === 1
          ? "Marcá el día en el calendario."
          : `Marcá ${sessionCount} días en el calendario.`,
      )
    return out
  }, [slots, days.length, sessionCount])

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

  function choosePackage(next: ClassPackageType) {
    setPackageType(next)
    // A smaller pack keeps the earliest days already marked.
    setDays((curr) => curr.slice(0, SESSIONS_BY_PACKAGE[next]))
  }

  function handleCalendarSelect(dates: Date[] | undefined) {
    const selected = (dates ?? []).map((d) => dateInputValue(d.getTime()))
    // react-day-picker's own `max` would restart the selection from the
    // extra day; a full package should just refuse the tap and say why.
    if (selected.length > sessionCount) {
      toast.info(
        sessionCount === 1
          ? "Ya marcaste el día. Desmarcalo para elegir otro."
          : `Ya marcaste los ${sessionCount} días. Desmarcá uno para cambiarlo.`,
      )
      return
    }
    setDays((curr) => mergeSessionDays(curr, selected, suggestedTime()))
  }

  function setDayTime(date: string, time: string) {
    setDays((curr) => curr.map((d) => (d.date === date ? { ...d, time } : d)))
  }

  function removeDay(date: string) {
    setDays((curr) => curr.filter((d) => d.date !== date))
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
      const startsAt = sessionStartsFromDays(days)
      if (editing) {
        await updateClass(editing.id, {
          startsAt: startsAt[0],
          students,
          notes: notes.trim() || null,
        })
        toast.success("Clase actualizada")
      } else {
        await createClassPackage({
          ownerId: user.uid,
          students,
          packageType,
          startsAt,
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

  const selectedDates = React.useMemo(
    () => days.map((d) => dateFromInputValue(d.date)),
    [days],
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={saving ? () => {} : onOpenChange}
      title={isEdit ? "Editar clase" : "Agendar clase"}
      description={
        isEdit
          ? "Los cambios aplican solo a esta clase del paquete."
          : "Elegí los alumnos, el paquete y marcá los días en el calendario."
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
                onChange={choosePackage}
                ariaLabel="Paquete de clases"
                disabled={saving}
                stacked
              />
            </Field>
          )}

          <Field>
            <FieldLabel>
              {isEdit
                ? "Día"
                : sessionCount === 1
                  ? "Día de la clase"
                  : `Días · ${days.length} de ${sessionCount}`}
            </FieldLabel>
            {/* Bigger cells on touch so a day is a 44 px target; the
                desktop dialog goes back to the compact default. */}
            <div className="flex justify-center rounded-lg border">
              <Calendar
                mode="multiple"
                locale={es}
                selected={selectedDates}
                onSelect={handleCalendarSelect}
                min={isEdit ? 1 : undefined}
                defaultMonth={selectedDates[0] ?? startOfToday()}
                disabled={{ before: startOfToday() }}
                className="[--cell-size:2.75rem] sm:[--cell-size:2.25rem]"
              />
            </div>
            {!isEdit && (
              <FieldDescription>
                {remaining > 0
                  ? remaining === sessionCount
                    ? sessionCount === 1
                      ? "Tocá el día de la clase."
                      : `Tocá los ${sessionCount} días del paquete, uno por clase.`
                    : `Falta${remaining > 1 ? "n" : ""} ${remaining} día${remaining > 1 ? "s" : ""} por marcar.`
                  : "Listo. Ajustá la hora de cada clase si hace falta."}
              </FieldDescription>
            )}
            {days.length > 0 && (
              <div className="space-y-2">
                {days.map((day) => (
                  <SessionRow
                    key={day.date}
                    day={day}
                    onTimeChange={(time) => setDayTime(day.date, time)}
                    onRemove={isEdit ? undefined : () => removeDay(day.date)}
                    disabled={saving}
                  />
                ))}
              </div>
            )}
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

/** One picked day with its start time. */
function SessionRow({
  day,
  onTimeChange,
  onRemove,
  disabled,
}: {
  day: SessionDay
  onTimeChange: (time: string) => void
  onRemove?: () => void
  disabled?: boolean
}) {
  // A legacy record can carry a time that's off the half-hour grid; keep it
  // selectable rather than showing an empty trigger.
  const options = CLASS_TIME_OPTIONS.includes(day.time)
    ? CLASS_TIME_OPTIONS
    : [...CLASS_TIME_OPTIONS, day.time].sort()
  const label = formatDayHeading(dateFromInputValue(day.date).getTime())

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium first-letter:uppercase">
        {label}
      </span>
      <Select
        value={day.time}
        onValueChange={(v) => {
          if (v) onTimeChange(v)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={`Hora de la clase del ${label}`}
          className="h-10 w-24 justify-between tabular-nums sm:h-8"
        >
          <SelectValue>{(value) => String(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {options.map((t) => (
            <SelectItem key={t} value={t} className="tabular-nums">
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 sm:size-8"
          aria-label={`Quitar ${label}`}
          onClick={onRemove}
          disabled={disabled}
        >
          <XIcon className="size-4" />
        </Button>
      )}
    </div>
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
