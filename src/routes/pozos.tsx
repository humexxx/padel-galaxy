import * as React from "react"
import { Link } from "react-router"
import {
  ArrowRightIcon,
  FolderIcon,
  PlusIcon,
  SearchIcon,
  TrophyIcon,
} from "lucide-react"
import { collection, doc } from "firebase/firestore"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { PozoCard } from "@/components/pozo/pozo-card"
import { useAuth } from "@/contexts/auth-context"
import { useGroups } from "@/hooks/use-groups"
import { usePozos } from "@/hooks/use-pozos"
import { db } from "@/lib/firebase"
import { createGroup, findGroupByName, type GroupRecord } from "@/lib/groups"
import { normalizeName } from "@/lib/players"
import { cn } from "@/lib/utils"

type Tab = "pozos" | "grupos"

export function PozosPage() {
  const { pozos, hydrated, remove } = usePozos()
  const { isAdmin } = useAuth()
  const active = pozos.filter((p) => p.status !== "finished")
  const [tab, setTab] = React.useState<Tab>("pozos")

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Heading level="h1">Pozos</Heading>
        <Text variant="muted">
          Organizá tus pozos de pádel, cronometrá y rankeá automáticamente.
        </Text>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pozos" className="text-xs">
            Pozos
          </TabsTrigger>
          <TabsTrigger value="grupos" className="text-xs">
            Grupos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pozos" className="space-y-4">
          {/* Skip the grid wrapper entirely when there's nothing to show in
              it — otherwise an empty `grid` div sits between the tabs strip
              and the empty-state card, adding a phantom gap (the
              `space-y-4` on the parent counts the empty div as a child). */}
          {(isAdmin || (hydrated && active.length > 0)) && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isAdmin && <CreatePozoCard />}
              {hydrated &&
                active.map((p) => (
                  <PozoCard key={p.id} pozo={p} onDelete={remove} />
                ))}
            </div>
          )}
          {hydrated && active.length === 0 && (
            <EmptyPozosHint canCreate={isAdmin} />
          )}
        </TabsContent>

        <TabsContent value="grupos" className="space-y-4">
          <GroupsSection isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function CreatePozoCard() {
  return (
    <Link
      to="/pozos/nuevo"
      aria-label="Crear pozo"
      className={cn(
        "rounded-xl ring-offset-background transition",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
    >
      <Card className="flex h-full min-h-44 flex-col items-center justify-center gap-3 border-dashed text-center text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
          <PlusIcon className="size-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Crear pozo</p>
          <p className="text-xs">Empezá uno nuevo</p>
        </div>
      </Card>
    </Link>
  )
}

function EmptyPozosHint({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <TrophyIcon className="size-6" />
      </div>
      <Text className="text-base font-semibold">No tenés pozos activos</Text>
      <Text variant="muted" className="max-w-md text-sm">
        {canCreate ? (
          <>
            Usá la card de arriba para crear el primero. Cuando termines uno, va
            a aparecer en{" "}
            <Link
              to="/historial"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Historial
            </Link>
            .
          </>
        ) : (
          <>
            Cuando un admin cree un pozo en el que estés, lo vas a ver acá. Los
            pozos terminados quedan en{" "}
            <Link
              to="/historial"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Historial
            </Link>
            .
          </>
        )}
      </Text>
    </div>
  )
}

function GroupsSection({ isAdmin }: { isAdmin: boolean }) {
  const { groups, hydrated } = useGroups()
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return groups
    return groups.filter((g) => g.nameLower.includes(q))
  }, [groups, search])

  // Player-tier accounts typically belong to a handful of groups, so a
  // card grid reads better than a table. Admins manage many groups across
  // an org and want the dense table.
  if (!isAdmin) {
    if (hydrated && groups.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <FolderIcon className="size-6" />
          </div>
          <Text className="text-base font-semibold">
            Todavía no estás en ningún grupo
          </Text>
          <Text variant="muted" className="max-w-md text-sm">
            Cuando un admin te incluya en un grupo lo vas a ver acá.
          </Text>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {groups.length > 4 && (
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
        )}
        {hydrated && filtered.length === 0 ? (
          <Text variant="muted" className="text-sm">
            Ningún grupo coincide con el filtro.
          </Text>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
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
          <CreateGroupDialog existingGroups={groups} />
        </div>

        {hydrated && groups.length === 0 ? (
          <EmptyGroups />
        ) : hydrated && filtered.length === 0 ? (
          <div className="px-4 pb-2 text-center">
            <Text variant="muted" className="text-sm">
              Ningún grupo coincide con el filtro.
            </Text>
          </div>
        ) : (
          <GroupsTable groups={filtered} />
        )}
      </div>
    </Card>
  )
}

function GroupCard({ group }: { group: GroupRecord }) {
  return (
    <Link
      to={`/pozos/grupos/${group.id}`}
      aria-label={`Abrir grupo ${group.name}`}
      className={cn(
        "rounded-xl ring-offset-background transition",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
    >
      <Card className="flex h-full min-h-36 flex-col gap-3 p-4 transition-colors hover:border-foreground/30">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderIcon className="size-5" />
          </span>
          <p className="truncate text-sm font-semibold">{group.name}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Creado{" "}
            {new Date(group.createdAt).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            Abrir
            <ArrowRightIcon className="size-3" />
          </span>
        </div>
      </Card>
    </Link>
  )
}

function GroupsTable({ groups }: { groups: GroupRecord[] }) {
  const { user } = useAuth()
  // We only know the current viewer's display info. For groups they own
  // we render "Tú · <display name>"; for groups owned by someone else
  // (admin viewing across the org) we fall back to a truncated uid since
  // we don't have a users-by-uid index handy.
  const meLabel = user?.displayName?.trim() || user?.email || "Tú"

  function creatorLabel(g: GroupRecord) {
    if (user && g.ownerId === user.uid) return meLabel
    return `${g.ownerId.slice(0, 6)}…`
  }

  return (
    <div className="overflow-hidden border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Nombre</TableHead>
            <TableHead className="hidden sm:table-cell">Creador</TableHead>
            <TableHead className="hidden md:table-cell">Creado</TableHead>
            <TableHead className="pr-4 text-right">Ver</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="pl-4 font-medium">
                <Link
                  to={`/pozos/grupos/${g.id}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FolderIcon className="size-3.5" />
                  </span>
                  {g.name}
                </Link>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                <span className="truncate">{creatorLabel(g)}</span>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {new Date(g.createdAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Link
                  to={`/pozos/grupos/${g.id}`}
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

function EmptyGroups() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 pb-2 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <FolderIcon className="size-6" />
      </div>
      <Text className="text-base font-semibold">Todavía no tenés grupos</Text>
      <Text variant="muted" className="max-w-md text-sm">
        Creá uno para empezar a organizar tus pozos por temporada, club o liga.
      </Text>
    </div>
  )
}

function CreateGroupDialog({ existingGroups }: { existingGroups: GroupRecord[] }) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const clean = name.trim()
    if (!clean) return
    // Dedup by normalized name.
    if (findGroupByName(existingGroups, clean)) {
      toast.error("Ya existe un grupo con ese nombre")
      return
    }
    setSaving(true)
    try {
      const id = doc(collection(db, "groups")).id
      await createGroup({ id, ownerId: user.uid, name: clean })
      toast.success("Grupo creado")
      setName("")
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error("No se pudo crear el grupo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <PlusIcon className="size-4" />
            Crear grupo
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Crear grupo nuevo</DialogTitle>
            <DialogDescription>
              Los grupos organizan los pozos para ver estadísticas combinadas.
            </DialogDescription>
          </DialogHeader>
          <div className="my-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="group-name">Nombre</FieldLabel>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Liga interna 2026"
                  required
                  autoFocus
                  disabled={saving}
                />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
