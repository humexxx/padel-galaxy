import * as React from "react"
import {
  CalendarArrowUpIcon,
  CalendarPlusIcon,
  GraduationCapIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { ClassCard } from "@/components/class/class-card"
import { ClassForm } from "@/components/class/class-form"
import { useClasses } from "@/hooks/use-classes"
import { useNow } from "@/hooks/use-now"
import {
  buildClassesIcs,
  exportableClasses,
  icsFilename,
  openIcs,
} from "@/lib/calendar"
import {
  dayKey,
  deleteClass,
  deleteClassPackage,
  formatDayHeading,
  groupByDay,
  sessionLabel,
  splitClasses,
  studentIndex,
  studentsLabel,
  type ClassRecord,
} from "@/lib/classes"
import { normalizeName } from "@/lib/players"
import { cn } from "@/lib/utils"

type Tab = "proximas" | "historial"

export function ClasesPage() {
  const { classes, hydrated } = useClasses()
  // A minute is fine: the only thing the clock decides here is when a class
  // slides from "Próximas" to "Historial".
  const now = useNow(60_000)
  const [tab, setTab] = React.useState<Tab>("proximas")
  const [search, setSearch] = React.useState("")
  const [studentId, setStudentId] = React.useState<string | null>(null)
  const [dayFilter, setDayFilter] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ClassRecord | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<ClassRecord | null>(
    null,
  )

  // Who's on the agenda — the chips. Built from every class, so a regular
  // stays filterable from Historial once their last session has passed.
  const students = React.useMemo(() => studentIndex(classes), [classes])

  const filtered = React.useMemo(() => {
    const q = normalizeName(search)
    return classes.filter(
      (c) =>
        (!studentId || c.students.some((s) => s.id === studentId)) &&
        (!q || c.students.some((s) => normalizeName(s.name).includes(q))),
    )
  }, [classes, search, studentId])

  const { upcoming, past } = React.useMemo(
    () => splitClasses(filtered, now),
    [filtered, now],
  )

  // Day chips for the upcoming side, one per day that has a class.
  const upcomingDays = React.useMemo(() => groupByDay(upcoming), [upcoming])
  const visibleUpcoming = React.useMemo(
    () =>
      dayFilter
        ? upcoming.filter((c) => dayKey(c.startsAt) === dayFilter)
        : upcoming,
    [upcoming, dayFilter],
  )

  // A day chip can vanish under us (class moved, taught, cancelled) — drop
  // the filter instead of showing an empty list with no chip to clear it.
  React.useEffect(() => {
    if (dayFilter && !upcomingDays.some((g) => g.key === dayFilter)) {
      setDayFilter(null)
    }
  }, [dayFilter, upcomingDays])

  const filtering = Boolean(search || studentId || dayFilter)

  function clearFilters() {
    setSearch("")
    setStudentId(null)
    setDayFilter(null)
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(record: ClassRecord) {
    setEditing(record)
    setFormOpen(true)
  }

  function addToCalendar(records: ClassRecord[]) {
    const exportable = exportableClasses(records)
    if (exportable.length === 0) {
      toast.error("No hay clases para agregar al calendario")
      return
    }
    try {
      const how = openIcs(buildClassesIcs(exportable), icsFilename(exportable))
      // iOS shows its own "Agregar" sheet, so only the download path needs
      // a hint about where the file went.
      if (how === "downloaded") {
        toast.success(
          exportable.length === 1
            ? "Se descargó la clase (.ics). Abrila para agregarla al calendario."
            : `Se descargaron ${exportable.length} clases (.ics). Abrí el archivo para agregarlas al calendario.`,
        )
      }
    } catch (err) {
      console.error("Error exporting classes to calendar:", err)
      toast.error("No se pudo exportar al calendario")
    }
  }

  function addToCalendarFromCard(record: ClassRecord, wholePackage: boolean) {
    addToCalendar(
      wholePackage
        ? classes.filter((c) => c.packageId === record.packageId)
        : [record],
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Clases</Heading>
          <Text variant="muted">
            Tu agenda de clases: elegí los alumnos, el paquete y el horario.
          </Text>
        </div>
        <Button
          onClick={openCreate}
          className="h-11 w-full shrink-0 sm:h-9 sm:w-auto"
        >
          <CalendarPlusIcon className="size-4" />
          Agendar clase
        </Button>
      </div>

      {classes.length > 0 && (
        <div className="space-y-3">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por alumno…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9 sm:h-9"
            />
          </div>
          {students.length > 1 && (
            <ChipRow label="Filtrar por alumno">
              <Chip active={!studentId} onClick={() => setStudentId(null)}>
                Todos
              </Chip>
              {students.map((s) => (
                <Chip
                  key={s.id}
                  active={studentId === s.id}
                  onClick={() =>
                    setStudentId((curr) => (curr === s.id ? null : s.id))
                  }
                  count={s.count}
                >
                  {s.name}
                </Chip>
              ))}
            </ChipRow>
          )}
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proximas" className="text-xs">
            Próximas
            {upcoming.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary tabular-nums">
                {upcoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial" className="text-xs">
            Historial
            {past.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                {past.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proximas" className="space-y-4">
          {hydrated && upcoming.length === 0 ? (
            filtering ? (
              <FilteredEmpty onClear={clearFilters} />
            ) : (
              <EmptyState
                title="No tenés clases agendadas"
                description="Agendá la primera: elegí el alumno, el paquete (individual, de 3 o de 5) y marcá los días."
              />
            )
          ) : (
            <>
              {upcomingDays.length > 1 && (
                <ChipRow label="Ir a un día">
                  <Chip active={!dayFilter} onClick={() => setDayFilter(null)}>
                    Todos
                  </Chip>
                  {upcomingDays.map((g) => (
                    <Chip
                      key={g.key}
                      active={dayFilter === g.key}
                      onClick={() =>
                        setDayFilter((curr) => (curr === g.key ? null : g.key))
                      }
                      count={g.classes.length}
                      className="first-letter:uppercase"
                    >
                      {formatDayHeading(g.ts, now)}
                    </Chip>
                  ))}
                </ChipRow>
              )}
              {visibleUpcoming.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 sm:h-8"
                    onClick={() => addToCalendar(visibleUpcoming)}
                  >
                    <CalendarArrowUpIcon className="size-4" />
                    Agregar al calendario
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums">
                      {visibleUpcoming.length}
                    </span>
                  </Button>
                </div>
              )}
              <DayGroups
                records={visibleUpcoming}
                now={now}
                onEdit={openEdit}
                onRequestDelete={setPendingDelete}
                onAddToCalendar={addToCalendarFromCard}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          {hydrated && past.length === 0 ? (
            filtering ? (
              <FilteredEmpty onClear={clearFilters} />
            ) : (
              <EmptyState
                title="Todavía no hay historial"
                description="Las clases dadas, canceladas o ya pasadas van a aparecer acá."
              />
            )
          ) : (
            <DayGroups
              records={past}
              now={now}
              onEdit={openEdit}
              onRequestDelete={setPendingDelete}
              onAddToCalendar={addToCalendarFromCard}
            />
          )}
        </TabsContent>
      </Tabs>

      <ClassForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <DeleteClassDialog
        record={pendingDelete}
        onClose={() => setPendingDelete(null)}
      />
    </PageContainer>
  )
}

/**
 * A single scrolling row of chips. Bleeds to the screen edges on phones so
 * the last chip peeks out as the hint that there are more; the scrollbar
 * is hidden because it would sit on top of the chips.
 */
function ChipRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  )
}

function Chip({
  active,
  count,
  onClick,
  className,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors sm:h-8",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-primary-foreground/20" : "bg-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function DayGroups({
  records,
  now,
  onEdit,
  onRequestDelete,
  onAddToCalendar,
}: {
  records: ClassRecord[]
  now: number
  onEdit: (record: ClassRecord) => void
  onRequestDelete: (record: ClassRecord) => void
  onAddToCalendar: (record: ClassRecord, wholePackage: boolean) => void
}) {
  const groups = React.useMemo(() => groupByDay(records), [records])

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          {/* Sticks under the app header so the day stays identifiable while
              scrolling a long agenda on a phone. */}
          <h2 className="sticky top-14 z-10 -mx-1 bg-background/95 px-1 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur supports-[backdrop-filter]:bg-background/70">
            {formatDayHeading(group.ts, now)}
          </h2>
          <div className="space-y-2">
            {group.classes.map((record) => (
              <ClassCard
                key={record.id}
                record={record}
                onEdit={onEdit}
                onRequestDelete={onRequestDelete}
                onAddToCalendar={onAddToCalendar}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <GraduationCapIcon className="size-6" />
      </div>
      <Text className="text-base font-semibold">{title}</Text>
      <Text variant="muted" className="max-w-md text-sm">
        {description}
      </Text>
    </div>
  )
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-8 text-center">
      <Text className="text-sm font-medium">
        Ninguna clase coincide con el filtro.
      </Text>
      <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={onClear}>
        <XIcon className="size-4" />
        Limpiar filtros
      </Button>
    </div>
  )
}

function DeleteClassDialog({
  record,
  onClose,
}: {
  record: ClassRecord | null
  onClose: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  // Remember the last non-null record so the copy doesn't blank out while
  // the dialog animates closed.
  const [shown, setShown] = React.useState<ClassRecord | null>(record)
  React.useEffect(() => {
    if (record) setShown(record)
  }, [record])
  const target = record ?? shown
  const isPack = (target?.sessionCount ?? 1) > 1

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    try {
      await action()
      toast.success(message)
      onClose()
    } catch (err) {
      console.error("Error deleting class:", err)
      toast.error("No se pudo eliminar")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar clase?</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                Clase de{" "}
                <span className="font-medium">
                  {studentsLabel(target.students)}
                </span>
                {sessionLabel(target) ? ` · ${sessionLabel(target)}` : ""}. Esta
                acción no se puede deshacer.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {/* Plain `flex-col` in both directions: the footer's default
            `flex-col-reverse` would flip these three into the opposite of
            the order they read in. */}
        <DialogFooter className="flex-col sm:flex-col sm:items-stretch">
          <Button
            variant="destructive"
            className="h-11 sm:h-9"
            disabled={busy || !target}
            onClick={() =>
              target &&
              run(() => deleteClass(target.id), "Clase eliminada")
            }
          >
            Eliminar esta clase
          </Button>
          {isPack && target && (
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              disabled={busy}
              onClick={() =>
                run(
                  () => deleteClassPackage(target.packageId),
                  "Paquete eliminado",
                )
              }
            >
              Eliminar el paquete completo ({target.sessionCount} clases)
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-11 sm:h-9"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
