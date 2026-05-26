import * as React from "react"
import { Link } from "react-router"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  MailIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { usePlayers } from "@/hooks/use-players"
import { normalizeName, type PlayerRecord } from "@/lib/players"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "linked" | "invited" | "none"

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Todos",
  linked: "Vinculados",
  invited: "Invitados",
  none: "Sin invitar",
}

function getStatus(p: PlayerRecord): "linked" | "invited" | "none" {
  if (p.linkedUid) return "linked"
  if (p.invitedAt) return "invited"
  return "none"
}

export function JugadoresPage() {
  const { players, hydrated } = usePlayers()
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")

  const filtered = React.useMemo(() => {
    const q = normalizeName(search)
    return players.filter((p) => {
      if (q && !p.nameLower.includes(q)) return false
      if (statusFilter !== "all" && getStatus(p) !== statusFilter) return false
      return true
    })
  }, [players, search, statusFilter])

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Heading level="h1">Jugadores</Heading>
        <Text variant="muted">
          Tu roster de jugadores. Vinculá sus cuentas y mirá su evolución.
        </Text>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                  <TabsTrigger key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {hydrated && players.length === 0 ? (
            <EmptyState />
          ) : hydrated && filtered.length === 0 ? (
            <NoMatchesHint />
          ) : (
            <PlayersTable players={filtered} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function PlayersTable({ players }: { players: PlayerRecord[] }) {
  return (
    <div className="-mx-4 overflow-hidden rounded-md border sm:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Jugador</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead className="pr-4 text-right">Ver</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p) => {
            const status = getStatus(p)
            return (
              <TableRow key={p.id}>
                <TableCell className="pl-4 font-medium">
                  <Link
                    to={`/jugadores/${p.id}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserIcon className="size-3.5" />
                    </span>
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={status} />
                </TableCell>
                <TableCell className="hidden truncate text-muted-foreground sm:table-cell">
                  {p.invitedEmail ?? "—"}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    to={`/jugadores/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Abrir
                    <ArrowRightIcon className="size-3" />
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function StatusBadge({ status }: { status: "linked" | "invited" | "none" }) {
  const config = {
    linked: {
      label: "Vinculado",
      icon: CheckCircle2Icon,
      cls: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40",
    },
    invited: {
      label: "Invitado",
      icon: ClockIcon,
      cls: "text-muted-foreground bg-muted",
    },
    none: {
      label: "Sin invitar",
      icon: MailIcon,
      cls: "text-muted-foreground bg-muted/60",
    },
  }[status]
  const Icon = config.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.cls,
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <UserIcon className="size-6" />
      </div>
      <Text className="text-base font-semibold">Todavía no tenés jugadores</Text>
      <Text variant="muted" className="max-w-md text-sm">
        Los jugadores se crean automáticamente cuando armás tu primer pozo y
        escribís sus nombres. Después aparecen acá.
      </Text>
    </div>
  )
}

function NoMatchesHint() {
  return (
    <div className="py-10 text-center">
      <Text variant="muted" className="text-sm">
        Ningún jugador coincide con el filtro.
      </Text>
    </div>
  )
}
