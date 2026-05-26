import * as React from "react"
import { Link } from "react-router"
import { ArrowRightIcon, FolderIcon, SearchIcon } from "lucide-react"

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
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { useGroups } from "@/hooks/use-groups"
import { normalizeName } from "@/lib/players"
import type { GroupRecord } from "@/lib/groups"

export function GruposPage() {
  const { groups, hydrated } = useGroups()
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return groups
    return groups.filter((g) => g.nameLower.includes(q))
  }, [groups, search])

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Heading level="h1">Grupos</Heading>
        <Text variant="muted">
          Organizá los pozos en grupos (un club, una temporada, una liga…) para
          ver estadísticas combinadas.
        </Text>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
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

          {hydrated && groups.length === 0 ? (
            <EmptyState />
          ) : hydrated && filtered.length === 0 ? (
            <NoMatchesHint />
          ) : (
            <GroupsTable groups={filtered} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function GroupsTable({ groups }: { groups: GroupRecord[] }) {
  return (
    <div className="-mx-4 overflow-hidden rounded-md border sm:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Nombre</TableHead>
            <TableHead className="hidden sm:table-cell">Creado</TableHead>
            <TableHead className="pr-4 text-right">Ver</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="pl-4 font-medium">
                <Link
                  to={`/grupos/${g.id}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FolderIcon className="size-3.5" />
                  </span>
                  {g.name}
                </Link>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {new Date(g.createdAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Link
                  to={`/grupos/${g.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Abrir
                  <ArrowRightIcon className="size-3" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <FolderIcon className="size-6" />
      </div>
      <Text className="text-base font-semibold">Todavía no tenés grupos</Text>
      <Text variant="muted" className="max-w-md text-sm">
        Los grupos se crean cuando armás un pozo y elegís un nombre nuevo en el
        selector de grupo del form.
      </Text>
    </div>
  )
}

function NoMatchesHint() {
  return (
    <div className="py-10 text-center">
      <Text variant="muted" className="text-sm">
        Ningún grupo coincide con el filtro.
      </Text>
    </div>
  )
}
