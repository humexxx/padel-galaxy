import * as React from "react"
import { CalendarPlusIcon, GraduationCapIcon, SearchIcon } from "lucide-react"
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
  deleteClass,
  deleteClassPackage,
  formatDayHeading,
  groupByDay,
  sessionLabel,
  splitClasses,
  studentsLabel,
  type ClassRecord,
} from "@/lib/classes"
import { normalizeName } from "@/lib/players"

type Tab = "proximas" | "historial"

/** Show the search box only once scanning the list by eye stops working. */
const SEARCH_THRESHOLD = 6

export function ClasesPage() {
  const { classes, hydrated } = useClasses()
  // A minute is fine: the only thing the clock decides here is when a class
  // slides from "Próximas" to "Historial".
  const now = useNow(60_000)
  const [tab, setTab] = React.useState<Tab>("proximas")
  const [search, setSearch] = React.useState("")
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ClassRecord | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<ClassRecord | null>(
    null,
  )

  const filtered = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return classes
    return classes.filter((c) =>
      c.students.some((s) => normalizeName(s.name).includes(q)),
    )
  }, [classes, search])

  const { upcoming, past } = React.useMemo(
    () => splitClasses(filtered, now),
    [filtered, now],
  )

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(record: ClassRecord) {
    setEditing(record)
    setFormOpen(true)
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

      {classes.length > SEARCH_THRESHOLD && (
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
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proximas" className="space-y-5">
          {hydrated && upcoming.length === 0 ? (
            <EmptyState
              title={
                search
                  ? "Ningún alumno coincide con la búsqueda"
                  : "No tenés clases agendadas"
              }
              description={
                search
                  ? "Probá con otro nombre o revisá el historial."
                  : "Agendá la primera: elegí el alumno, el paquete (individual, de 3 o de 5) y el día."
              }
            />
          ) : (
            <DayGroups
              records={upcoming}
              now={now}
              onEdit={openEdit}
              onRequestDelete={setPendingDelete}
            />
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-5">
          {hydrated && past.length === 0 ? (
            <EmptyState
              title="Todavía no hay historial"
              description="Las clases dadas, canceladas o ya pasadas van a aparecer acá."
            />
          ) : (
            <DayGroups
              records={past}
              now={now}
              onEdit={openEdit}
              onRequestDelete={setPendingDelete}
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

function DayGroups({
  records,
  now,
  onEdit,
  onRequestDelete,
}: {
  records: ClassRecord[]
  now: number
  onEdit: (record: ClassRecord) => void
  onRequestDelete: (record: ClassRecord) => void
}) {
  const groups = React.useMemo(() => groupByDay(records), [records])

  return (
    <>
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
              />
            ))}
          </div>
        </section>
      ))}
    </>
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
