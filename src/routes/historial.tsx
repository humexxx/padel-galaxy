import * as React from "react"
import { Link } from "react-router"
import {
  ArrowRightIcon,
  ClockIcon,
  FolderIcon,
  SearchIcon,
  Trash2Icon,
  TrophyIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { useAuth } from "@/contexts/auth-context"
import { useGroups } from "@/hooks/use-groups"
import { usePozos } from "@/hooks/use-pozos"
import { normalizeName } from "@/lib/players"
import { computeStandings, sortStandings } from "@/lib/pozo/standings"
import { formatRelative } from "@/lib/time"
import type { Pozo } from "@/lib/pozo/types"

/** Sliding-window date filters. Calendar periods would be confusing here
 * (a user wants "last 30 days" not "this calendar month"). */
type RangeKey = "30d" | "90d" | "365d" | "all"

const RANGE_LABELS: Record<RangeKey, string> = {
  "30d": "30d",
  "90d": "90d",
  "365d": "1 año",
  all: "Todo",
}

const RANGE_DAYS: Record<RangeKey, number | null> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
  all: null,
}

/** Sentinel select values — Base UI Select treats empty string as "no
 * selection", so we use stable non-empty strings instead. */
const GROUP_ALL = "__all__"
const GROUP_NONE = "__none__"

/** Player-count buckets — handy when looking for "the small Friday pozos"
 * or "the big Saturday tournaments". Buckets pick themselves from the
 * standard 4 / 8 / 12 / 16 sizes most organizers use. */
type SizeKey = "all" | "lt8" | "8" | "gt8"

const SIZE_LABELS: Record<SizeKey, string> = {
  all: "Cualquier tamaño",
  lt8: "Menos de 8 jugadores",
  "8": "8 jugadores",
  gt8: "Más de 8 jugadores",
}

function matchesSize(playerCount: number, key: SizeKey): boolean {
  switch (key) {
    case "all":
      return true
    case "lt8":
      return playerCount < 8
    case "8":
      return playerCount === 8
    case "gt8":
      return playerCount > 8
  }
}

export function HistorialPage() {
  const { pozos, hydrated, remove } = usePozos()
  const { groups } = useGroups()
  const { isAdmin } = useAuth()

  const [search, setSearch] = React.useState("")
  const [range, setRange] = React.useState<RangeKey>("all")
  const [groupId, setGroupId] = React.useState<string>(GROUP_ALL)
  const [size, setSize] = React.useState<SizeKey>("all")

  const groupsById = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.id, g.name)
    return m
  }, [groups])

  const finished = React.useMemo(
    () =>
      pozos
        .filter((p) => p.status === "finished")
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [pozos],
  )

  // Apply all filters in one pass. Order matters only for performance; the
  // result is the same regardless. Search is last so the visible-count tags
  // ("X de Y") match what the user sees in the filter chips.
  const filtered = React.useMemo(() => {
    const days = RANGE_DAYS[range]
    const cutoff = days === null ? -Infinity : Date.now() - days * 24 * 60 * 60 * 1000
    const q = normalizeName(search)
    return finished.filter((p) => {
      const ts = p.finishedAt ?? p.createdAt
      if (ts < cutoff) return false
      if (groupId === GROUP_NONE && p.groupId) return false
      if (groupId !== GROUP_ALL && groupId !== GROUP_NONE && p.groupId !== groupId) return false
      if (!matchesSize(p.players.length, size)) return false
      if (q) {
        const inName = normalizeName(p.name).includes(q)
        const groupName = p.groupId ? groupsById.get(p.groupId) : undefined
        const inGroup = groupName ? normalizeName(groupName).includes(q) : false
        if (!inName && !inGroup) return false
      }
      return true
    })
  }, [finished, range, groupId, size, search, groupsById])

  const filtersActive =
    search.trim() !== "" || range !== "all" || groupId !== GROUP_ALL || size !== "all"

  function resetFilters() {
    setSearch("")
    setRange("all")
    setGroupId(GROUP_ALL)
    setSize("all")
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Heading level="h1">Historial</Heading>
        <Text variant="muted">
          {hydrated && finished.length > 0
            ? filtersActive
              ? `Mostrando ${filtered.length} de ${finished.length} pozos finalizados.`
              : `${finished.length} pozos finalizados en total.`
            : "Tus pozos finalizados aparecen acá."}
        </Text>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          {/* Top row: search + date range (most-used filters). */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por pozo o grupo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                {(Object.keys(RANGE_LABELS) as RangeKey[]).map((r) => (
                  <TabsTrigger key={r} value={r} className="text-xs">
                    {RANGE_LABELS[r]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Second row: group + size selects + clear button. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={groupId} onValueChange={(v) => v && setGroupId(v)}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue>
                    {(value) => {
                      if (value === GROUP_ALL) return "Todos los grupos"
                      if (value === GROUP_NONE) return "Sin grupo"
                      return groupsById.get(String(value)) ?? "Grupo desconocido"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GROUP_ALL}>Todos los grupos</SelectItem>
                  <SelectItem value={GROUP_NONE}>Sin grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Pozo size filter is an organizer tool — a player typically
                  only sees a handful of pozos and doesn't slice by size. */}
              {isAdmin && (
                <Select value={size} onValueChange={(v) => v && setSize(v as SizeKey)}>
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue>
                      {(value) => SIZE_LABELS[(value as SizeKey) ?? "all"]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SIZE_LABELS) as SizeKey[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SIZE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>

          {!hydrated ? (
            <SkeletonTable />
          ) : finished.length === 0 ? (
            <EmptyHistorial />
          ) : filtered.length === 0 ? (
            <NoMatchesHint onReset={filtersActive ? resetFilters : undefined} />
          ) : (
            <HistorialTable
              pozos={filtered}
              groupsById={groupsById}
              onDelete={remove}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function HistorialTable({
  pozos,
  groupsById,
  onDelete,
}: {
  pozos: Pozo[]
  groupsById: Map<string, string>
  onDelete: (id: string) => void
}) {
  return (
    <div className="-mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-md sm:border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Pozo</TableHead>
            <TableHead className="hidden md:table-cell">Grupo</TableHead>
            <TableHead className="text-center" title="Cantidad de jugadores">
              Jug.
            </TableHead>
            <TableHead className="hidden sm:table-cell">Ganador</TableHead>
            <TableHead className="hidden sm:table-cell">Fecha</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pozos.map((p) => {
            const winner = getWinner(p)
            const groupName = p.groupId ? groupsById.get(p.groupId) : undefined
            return (
              <TableRow key={p.id}>
                <TableCell className="pl-4 font-medium">
                  <Link to={`/pozos/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {groupName && p.groupId ? (
                    <Link
                      to={`/pozos/grupos/${p.groupId}`}
                      className="inline-flex items-center gap-1.5 hover:underline"
                    >
                      <FolderIcon className="size-3.5" />
                      {groupName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {p.players.length}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {winner ? (
                    <span className="inline-flex items-center gap-1.5">
                      <TrophyIcon className="size-3.5 text-amber-500" />
                      {winner}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatRelative(p.finishedAt ?? p.createdAt)}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/pozos/${p.id}`} className="gap-1">
                        Ver
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    </Button>
                    <DeleteButton pozo={p} onDelete={onDelete} />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Top finisher of a pozo. We use the "games" metric — same default as the
 * podium — so the historial agrees with what the user sees inside the pozo.
 */
function getWinner(pozo: Pozo): string | null {
  if (pozo.players.length === 0) return null
  const standings = computeStandings(pozo.players, pozo.matches)
  const sorted = sortStandings(standings, "games", pozo.matches)
  return sorted[0]?.player.name ?? null
}

function DeleteButton({
  pozo,
  onDelete,
}: {
  pozo: Pozo
  onDelete: (id: string) => void
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Eliminar ${pozo.name}`} />
        }
      >
        <Trash2Icon className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar pozo?</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Se borrarán todos los partidos y resultados de
            <span className="font-medium"> {pozo.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete(pozo.id)
              toast.success("Pozo eliminado")
            }}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SkeletonTable() {
  return (
    <div className="-mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-md sm:border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Pozo</TableHead>
            <TableHead className="hidden md:table-cell">Grupo</TableHead>
            <TableHead className="text-center">Jug.</TableHead>
            <TableHead className="hidden sm:table-cell">Ganador</TableHead>
            <TableHead className="hidden sm:table-cell">Fecha</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="pl-4">
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="mx-auto h-4 w-6" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Skeleton className="ml-auto h-7 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function NoMatchesHint({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Text variant="muted" className="text-sm">
        Ningún pozo coincide con los filtros aplicados.
      </Text>
      {onReset && (
        <Button variant="outline" size="sm" onClick={onReset}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

function EmptyHistorial() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <ClockIcon className="size-6" />
      </div>
      <p className="text-base font-semibold">Sin pozos finalizados</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Cuando termines un pozo va a aparecer acá con el podio y la tabla final.{" "}
        <Link
          to="/pozos"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Ir a Pozos
        </Link>
        .
      </p>
    </div>
  )
}
