import * as React from "react"
import {
  CalendarArrowUpIcon,
  CalendarPlusIcon,
  CheckIcon,
  GraduationCapIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ResponsiveConfirm, type ConfirmAction } from "@/components/ui/responsive-confirm"
import { SearchField } from "@/components/ui/search-field"
import {
  Sheet,
  SheetContent,
  SheetGrabber,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  type ClassDayGroup,
  type ClassRecord,
  type StudentSummary,
} from "@/lib/classes"
import { normalizeName } from "@/lib/players"
import { cn } from "@/lib/utils"

type Tab = "proximas" | "historial"

/**
 * Two layouts for the same state. On a phone the controls collapse into one
 * toolbar row (search, a Filtros button that opens a sheet, export) plus a
 * date strip like the Calendar app's — five stacked rows of chips pushed
 * the first class below the fold. From `lg` up the same filters sit in a
 * sticky sidebar as vertical lists, where the width is there to use.
 */
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
  const [filtersOpen, setFiltersOpen] = React.useState(false)

  // Who's on the agenda. Built from every class, so a regular stays
  // filterable from Historial once their last session has passed.
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

  const upcomingDays = React.useMemo(() => groupByDay(upcoming), [upcoming])
  const visibleUpcoming = React.useMemo(
    () =>
      dayFilter
        ? upcoming.filter((c) => dayKey(c.startsAt) === dayFilter)
        : upcoming,
    [upcoming, dayFilter],
  )

  // A day can vanish under us (class moved, taught, cancelled) — drop the
  // filter instead of showing an empty list with nothing to clear it.
  React.useEffect(() => {
    if (dayFilter && !upcomingDays.some((g) => g.key === dayFilter)) {
      setDayFilter(null)
    }
  }, [dayFilter, upcomingDays])

  const filtering = Boolean(search || studentId || dayFilter)
  const showDays = tab === "proximas" && upcomingDays.length > 1

  function clearFilters() {
    setSearch("")
    setStudentId(null)
    setDayFilter(null)
  }

  function toggleStudent(id: string | null) {
    setStudentId((curr) => (id !== null && curr === id ? null : id))
  }

  function toggleDay(key: string | null) {
    setDayFilter((curr) => (key !== null && curr === key ? null : key))
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

  const searchBox = (
    <SearchField
      placeholder="Buscar por alumno…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  )

  const exportButton = visibleUpcoming.length > 0 && (
    <Button
      variant="outline"
      className="h-10 sm:h-9"
      onClick={() => addToCalendar(visibleUpcoming)}
    >
      <CalendarArrowUpIcon className="size-4" />
      Agregar al calendario
      <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums">
        {visibleUpcoming.length}
      </span>
    </Button>
  )

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Clases</Heading>
          <Text variant="muted">
            Tu agenda de clases: elegí los alumnos, el paquete y el horario.
          </Text>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden lg:block">{exportButton}</div>
          <Button
            onClick={openCreate}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            <CalendarPlusIcon className="size-4" />
            Agendar clase
          </Button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        {classes.length > 0 && (
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:space-y-6 lg:overflow-y-auto">
            {searchBox}
            <SidebarSection title="Alumnos">
              <SidebarRow active={!studentId} onClick={() => toggleStudent(null)}>
                Todos
              </SidebarRow>
              {students.map((s) => (
                <SidebarRow
                  key={s.id}
                  active={studentId === s.id}
                  count={s.count}
                  onClick={() => toggleStudent(s.id)}
                >
                  {s.name}
                </SidebarRow>
              ))}
            </SidebarSection>
            {showDays && (
              <SidebarSection title="Días">
                <SidebarRow active={!dayFilter} onClick={() => toggleDay(null)}>
                  Todos
                </SidebarRow>
                {upcomingDays.map((g) => (
                  <SidebarRow
                    key={g.key}
                    active={dayFilter === g.key}
                    count={g.classes.length}
                    onClick={() => toggleDay(g.key)}
                    className="first-letter:uppercase"
                  >
                    {formatDayHeading(g.ts, now)}
                  </SidebarRow>
                ))}
              </SidebarSection>
            )}
          </aside>
        )}

        <div className={cn("space-y-4", classes.length === 0 && "lg:col-span-2")}>
          {classes.length > 0 && (
            <div className="flex items-center gap-2 lg:hidden">
              <SearchField
                placeholder="Buscar por alumno…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1"
              />
              {students.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={
                    studentId ? "Filtros (1 activo)" : "Filtrar por alumno"
                  }
                  className="relative shrink-0"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontalIcon className="size-4" />
                  {studentId && (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      1
                    </span>
                  )}
                </Button>
              )}
              {tab === "proximas" && visibleUpcoming.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Agregar ${visibleUpcoming.length} clases al calendario`}
                  className="shrink-0"
                  onClick={() => addToCalendar(visibleUpcoming)}
                >
                  <CalendarArrowUpIcon className="size-4" />
                </Button>
              )}
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2 lg:inline-grid lg:w-80">
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
                  {showDays && (
                    <DayStrip
                      groups={upcomingDays}
                      active={dayFilter}
                      now={now}
                      onSelect={toggleDay}
                    />
                  )}
                  <DayGroups
                    groups={groupByDay(visibleUpcoming)}
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
                  groups={groupByDay(past)}
                  now={now}
                  onEdit={openEdit}
                  onRequestDelete={setPendingDelete}
                  onAddToCalendar={addToCalendarFromCard}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ClassForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        students={students}
        studentId={studentId}
        onSelect={(id) => {
          toggleStudent(id)
          setFiltersOpen(false)
        }}
      />
      <DeleteClassDialog
        record={pendingDelete}
        onClose={() => setPendingDelete(null)}
      />
    </PageContainer>
  )
}

function SidebarSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1">
      <h3 className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function SidebarRow({
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
        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className={cn("min-w-0 truncate", className)}>{children}</span>
      {count !== undefined && (
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-primary/15" : "bg-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * The phone's day picker, drawn the way Calendar and Fitness draw a week:
 * weekday over a big day number, the class count underneath, today ringed.
 * Only days that have a class appear — it's a "jump to" strip, not a
 * month view — and it scrolls edge to edge so the last cell peeks out.
 */
function DayStrip({
  groups,
  active,
  now,
  onSelect,
}: {
  groups: ClassDayGroup[]
  active: string | null
  now: number
  onSelect: (key: string | null) => void
}) {
  const total = groups.reduce((n, g) => n + g.classes.length, 0)
  return (
    <div
      role="group"
      aria-label="Ir a un día"
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      <DayCell
        label="Todo"
        value={total}
        sub={total === 1 ? "clase" : "clases"}
        active={active === null}
        onClick={() => onSelect(null)}
        ariaLabel={`Todos los días, ${total} clases`}
      />
      {groups.map((g) => {
        const d = new Date(g.ts)
        const count = g.classes.length
        return (
          <DayCell
            key={g.key}
            label={d
              .toLocaleDateString("es-AR", { weekday: "short" })
              .replace(".", "")}
            value={d.getDate()}
            sub={`${count} ${count === 1 ? "clase" : "clases"}`}
            today={dayKey(g.ts) === dayKey(now)}
            active={active === g.key}
            onClick={() => onSelect(g.key)}
            ariaLabel={`${formatDayHeading(g.ts, now)}, ${count} ${count === 1 ? "clase" : "clases"}`}
          />
        )
      })}
    </div>
  )
}

function DayCell({
  label,
  value,
  sub,
  today,
  active,
  onClick,
  ariaLabel,
}: {
  label: string
  value: number
  sub: string
  today?: boolean
  active: boolean
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground hover:bg-muted/70",
        today && !active && "ring-2 ring-primary/50 ring-inset",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold tracking-wide uppercase",
          active ? "text-primary-foreground/80" : "text-muted-foreground",
          today && !active && "text-primary",
        )}
      >
        {label}
      </span>
      <span className="text-lg leading-none font-semibold tabular-nums">
        {value}
      </span>
      <span
        className={cn(
          "text-[10px] tabular-nums",
          active ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {sub}
      </span>
    </button>
  )
}

/**
 * Filters on a phone live behind the toolbar's Filtros button, in a sheet:
 * a single-choice list with the check on the right, the way iOS settings
 * pick one of several. Choosing applies and closes; Limpiar resets.
 */
function FilterSheet({
  open,
  onOpenChange,
  students,
  studentId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: StudentSummary[]
  studentId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[80dvh] gap-0 rounded-t-3xl p-0"
      >
        <SheetGrabber />
        <SheetHeader className="flex-row items-center justify-between border-b px-4 pt-1 pb-3">
          <SheetTitle>Filtrar por alumno</SheetTitle>
          {studentId && (
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
              Limpiar
            </Button>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
          <FilterRow active={!studentId} onClick={() => onSelect(null)}>
            Todos los alumnos
          </FilterRow>
          {students.map((s) => (
            <FilterRow
              key={s.id}
              active={studentId === s.id}
              count={s.count}
              onClick={() => onSelect(s.id)}
            >
              {s.name}
            </FilterRow>
          ))}
        </div>
        <div className="border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Listo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FilterRow({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
      <CheckIcon
        className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-0")}
      />
    </button>
  )
}

function DayGroups({
  groups,
  now,
  onEdit,
  onRequestDelete,
  onAddToCalendar,
}: {
  groups: ClassDayGroup[]
  now: number
  onEdit: (record: ClassRecord) => void
  onRequestDelete: (record: ClassRecord) => void
  onAddToCalendar: (record: ClassRecord, wholePackage: boolean) => void
}) {
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
  // the sheet animates closed.
  const [shown, setShown] = React.useState<ClassRecord | null>(record)
  React.useEffect(() => {
    if (record) setShown(record)
  }, [record])
  const target = record ?? shown

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

  const actions: ConfirmAction[] = target
    ? [
        {
          label: "Eliminar esta clase",
          destructive: true,
          onSelect: () => run(() => deleteClass(target.id), "Clase eliminada"),
        },
        ...(target.sessionCount > 1
          ? [
              {
                label: `Eliminar el paquete completo (${target.sessionCount} clases)`,
                destructive: true,
                onSelect: () =>
                  run(
                    () => deleteClassPackage(target.packageId),
                    "Paquete eliminado",
                  ),
              },
            ]
          : []),
      ]
    : []

  return (
    <ResponsiveConfirm
      open={Boolean(record)}
      onOpenChange={(open) => !open && onClose()}
      title="¿Eliminar clase?"
      description={
        target && (
          <>
            Clase de{" "}
            <span className="font-medium">{studentsLabel(target.students)}</span>
            {sessionLabel(target) ? ` · ${sessionLabel(target)}` : ""}. Esta
            acción no se puede deshacer.
          </>
        )
      }
      actions={actions}
      busy={busy}
    />
  )
}
