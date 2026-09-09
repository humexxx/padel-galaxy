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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { ClassCard } from "@/components/class/class-card"
import { ClassForm } from "@/components/class/class-form"
import { useClasses } from "@/hooks/use-classes"
import { useIsMobile } from "@/hooks/use-media-query"
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
} from "@/lib/classes"
import { normalizeName } from "@/lib/players"
import { cn } from "@/lib/utils"

type Tab = "proximas" | "historial"

/**
 * Two layouts for the same state. On a phone the filters are horizontal
 * chip rows above the list, because that's what a thumb can reach. From
 * `lg` up they move into a sticky sidebar as vertical lists — the width is
 * there, and stacking chip rows across a 1000 px page just reads as
 * clutter with the cards stretched underneath.
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
    <div className="relative w-full">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Buscar por alumno…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-11 rounded-xl border-transparent bg-muted pl-9 shadow-none focus-visible:bg-background sm:h-9 dark:bg-muted dark:focus-visible:bg-background"
      />
    </div>
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
            <div className="space-y-3 lg:hidden">
              {searchBox}
              {students.length > 1 && (
                <ChipRow label="Filtrar por alumno">
                  <Chip active={!studentId} onClick={() => toggleStudent(null)}>
                    Todos
                  </Chip>
                  {students.map((s) => (
                    <Chip
                      key={s.id}
                      active={studentId === s.id}
                      count={s.count}
                      onClick={() => toggleStudent(s.id)}
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
                    <ChipRow label="Ir a un día" className="lg:hidden">
                      <Chip active={!dayFilter} onClick={() => toggleDay(null)}>
                        Todos
                      </Chip>
                      {upcomingDays.map((g) => (
                        <Chip
                          key={g.key}
                          active={dayFilter === g.key}
                          count={g.classes.length}
                          onClick={() => toggleDay(g.key)}
                          className="first-letter:uppercase"
                        >
                          {formatDayHeading(g.ts, now)}
                        </Chip>
                      ))}
                    </ChipRow>
                  )}
                  <div className="flex justify-end lg:hidden">{exportButton}</div>
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
 * A single scrolling row of chips. Bleeds to the screen edges on phones so
 * the last chip peeks out as the hint that there are more; the scrollbar
 * is hidden because it would sit on top of the chips.
 */
function ChipRow({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
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
          : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
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
  // the dialog animates closed.
  const [shown, setShown] = React.useState<ClassRecord | null>(record)
  React.useEffect(() => {
    if (record) setShown(record)
  }, [record])
  const target = record ?? shown
  const isPack = (target?.sessionCount ?? 1) > 1
  const isMobile = useIsMobile()

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

  const summary = target && (
    <>
      Clase de <span className="font-medium">{studentsLabel(target.students)}</span>
      {sessionLabel(target) ? ` · ${sessionLabel(target)}` : ""}. Esta acción no
      se puede deshacer.
    </>
  )

  // On a phone a destructive choice is an action sheet: the options rise
  // from the bottom as one grouped card, red for what deletes, and
  // "Cancelar" stands apart in its own card so it can't be hit by mistake.
  if (isMobile) {
    return (
      <Sheet open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-2 border-0 bg-transparent p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-none"
        >
          <div className="overflow-hidden rounded-2xl bg-popover">
            <SheetHeader className="items-center gap-1 border-b px-6 py-3 text-center">
              <SheetTitle className="text-[13px] font-semibold text-muted-foreground">
                ¿Eliminar clase?
              </SheetTitle>
              <SheetDescription className="text-[13px]">{summary}</SheetDescription>
            </SheetHeader>
            <Button
              variant="ghost"
              className="h-14 w-full rounded-none text-[17px] font-normal text-destructive hover:text-destructive"
              disabled={busy || !target}
              onClick={() =>
                target && run(() => deleteClass(target.id), "Clase eliminada")
              }
            >
              Eliminar esta clase
            </Button>
            {isPack && target && (
              <Button
                variant="ghost"
                className="h-14 w-full rounded-none border-t text-[17px] font-normal text-destructive hover:text-destructive"
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
          </div>
          <Button
            variant="ghost"
            className="h-14 w-full rounded-2xl bg-popover text-[17px] font-semibold text-primary hover:text-primary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar clase?</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
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
