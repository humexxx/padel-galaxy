import * as React from "react"
import {
  Loader2Icon,
  MailIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  ShieldPlusIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { useAdminInvites } from "@/hooks/use-admin-invites"
import { useAdmins } from "@/hooks/use-admins"
import { useClienteUsers } from "@/hooks/use-cliente-users"
import { useAuth } from "@/contexts/auth-context"
import { useAppSettings } from "@/hooks/use-settings"
import {
  createInvite,
  deleteInvite,
  findInvite,
  type AdminInvite,
} from "@/lib/admin-invites"
import { saveAppSettings } from "@/lib/settings"
import { looksLikeEmail } from "@/lib/email"
import {
  findUserByEmail,
  setUserRole,
  type UserProfile,
} from "@/lib/user-profile"
import { cn } from "@/lib/utils"

export function AdminPage() {
  const { user } = useAuth()

  return (
    <PageContainer>
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <ShieldCheckIcon className="size-6" />
        </div>
        <div>
          <Heading level="h1">Admin</Heading>
          <Text variant="muted">
            Ingresaste como superadmin ({user?.email}). Solo vos ves este panel.
          </Text>
        </div>
      </div>

      <InviteAdminCard />
      <PendingInvitesCard />
      <AdminsCard />
      <ClientesCard />
      <SignupsToggleCard />
    </PageContainer>
  )
}

/* -------------------------------------------------------------------------- */
/* Invite admin                                                                */
/* -------------------------------------------------------------------------- */

function InviteAdminCard() {
  const { user } = useAuth()
  const [email, setEmail] = React.useState("")
  const [sending, setSending] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const clean = email.trim()
    if (!clean) return
    if (!looksLikeEmail(clean)) {
      toast.error("Ingresá un email válido.")
      return
    }

    setSending(true)
    try {
      // FAST PATH: if the email already has a registered account, promote
      // them directly instead of sending an invite email. The invite-by-mail
      // flow only works for users who DON'T yet have an account — for
      // already-registered users, ensureUserProfile's "existing doc" branch
      // never re-derives role, so the invite would never auto-consume.
      // The superadmin's setUserRole bypasses the self-update restriction
      // (the firestore rule allows superadmin to change any user's role).
      const existingUser = await findUserByEmail(clean)
      if (existingUser) {
        if (existingUser.role === "superadmin") {
          toast.error(`${existingUser.email} ya es superadmin.`)
          return
        }
        if (existingUser.role === "admin") {
          toast.error(`${existingUser.email} ya es admin.`)
          return
        }
        await setUserRole(existingUser.uid, "admin")
        // If there's a leftover invite for the same email (e.g. they were
        // invited BEFORE they registered), clean it up so the pending-invites
        // table stays accurate.
        const staleInvite = await findInvite(clean)
        if (staleInvite) {
          await deleteInvite(staleInvite.email)
        }
        toast.success(
          `${existingUser.displayName || existingUser.email} promovido a admin.`,
        )
        setEmail("")
        return
      }

      // SLOW PATH: no registered user yet → create an invite + send email.
      // The doc id is the normalized email so a duplicate invite would
      // silently overwrite — surface "already pending" instead.
      const existingInvite = await findInvite(clean)
      if (existingInvite) {
        toast.error("Ya hay una invitación pendiente para ese email.")
        return
      }
      await createInvite({ email: clean, invitedBy: user.uid })
      toast.success(`Invitación enviada a ${clean}.`)
      setEmail("")
    } catch (err) {
      if (err instanceof Error && err.message === "invite-created-but-mail-failed") {
        toast.warning(
          "La invitación quedó creada pero no se pudo enviar el email. " +
            "Revisá que la extensión Trigger Email esté configurada.",
        )
        setEmail("")
      } else {
        console.error("Error creating admin invite:", err)
        toast.error("No se pudo crear la invitación.")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlusIcon className="size-4" />
          Invitar nuevo admin
        </CardTitle>
        <CardDescription>
          Si el email ya tiene cuenta lo promovemos directo. Si no, mandamos
          un email a esa dirección y cuando esa persona se registre con ese
          email queda como admin — incluso si el registro está cerrado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <FieldGroup className="flex-1">
            <Field>
              <FieldLabel htmlFor="invite-email">Email del nuevo admin</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@ejemplo.com"
                disabled={sending}
                required
              />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={!email.trim() || sending} className="shrink-0">
            {sending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <SendIcon className="size-4" />
                Invitar / promover
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Pending invites                                                             */
/* -------------------------------------------------------------------------- */

function PendingInvitesCard() {
  const { invites, hydrated } = useAdminInvites()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailIcon className="size-4" />
          Invitaciones pendientes
          {hydrated && invites.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {invites.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Personas a las que invitaste pero que todavía no se registraron.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!hydrated ? (
          <div className="px-6 pb-6">
            <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        ) : invites.length === 0 ? (
          <div className="px-6 pb-6 text-center">
            <Text variant="muted" className="text-sm">
              Sin invitaciones pendientes.
            </Text>
          </div>
        ) : (
          <InvitesTable invites={invites} />
        )}
      </CardContent>
    </Card>
  )
}

function InvitesTable({ invites }: { invites: AdminInvite[] }) {
  return (
    <div className="overflow-hidden border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Email</TableHead>
            <TableHead className="hidden sm:table-cell">Invitado</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((inv) => (
            <TableRow key={inv.email}>
              <TableCell className="pl-4 font-medium">
                {inv.emailDisplay}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {new Date(inv.invitedAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <RevokeInviteButton invite={inv} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RevokeInviteButton({ invite }: { invite: AdminInvite }) {
  async function handleRevoke() {
    try {
      await deleteInvite(invite.email)
      toast.success("Invitación revocada.")
    } catch (err) {
      console.error("Error revoking invite:", err)
      toast.error("No se pudo revocar la invitación.")
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRevoke}
      aria-label={`Revocar invitación a ${invite.emailDisplay}`}
    >
      <XIcon className="size-3.5" />
      Revocar
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/* Current admins                                                              */
/* -------------------------------------------------------------------------- */

function AdminsCard() {
  const { admins, hydrated } = useAdmins()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheckIcon className="size-4" />
          Admins actuales
          {hydrated && admins.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {admins.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Usuarios con rol admin o superadmin. Solo el superadmin puede
          revocar otros admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!hydrated ? (
          <div className="px-6 pb-6">
            <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        ) : admins.length === 0 ? (
          <div className="px-6 pb-6 text-center">
            <Text variant="muted" className="text-sm">
              No hay admins todavía.
            </Text>
          </div>
        ) : (
          <AdminsTable admins={admins} />
        )}
      </CardContent>
    </Card>
  )
}

function AdminsTable({ admins }: { admins: UserProfile[] }) {
  const { user } = useAuth()
  // Sort superadmins first, then admins, then alpha by email — keeps the
  // table stable and "puts the boss at the top".
  const sorted = React.useMemo(() => {
    return [...admins].sort((a, b) => {
      if (a.role !== b.role) return a.role === "superadmin" ? -1 : 1
      return a.email.localeCompare(b.email)
    })
  }, [admins])

  return (
    <div className="overflow-hidden border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((u) => {
            const isMe = user?.uid === u.uid
            const isSuperAdmin = u.role === "superadmin"
            return (
              <TableRow key={u.uid}>
                <TableCell className="pl-4">
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">{u.displayName || u.email}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {isSuperAdmin ? (
                    <Text variant="muted" className="text-xs">
                      —
                    </Text>
                  ) : (
                    <DemoteAdminButton user={u} disabled={isMe} />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function RoleBadge({ role }: { role: UserProfile["role"] }) {
  const cls =
    role === "superadmin"
      ? "bg-primary/10 text-primary"
      : role === "admin"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : "bg-muted text-muted-foreground"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {role === "superadmin" ? "Superadmin" : role === "admin" ? "Admin" : "Jugador"}
    </span>
  )
}

function DemoteAdminButton({
  user,
  disabled,
}: {
  user: UserProfile
  disabled: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [working, setWorking] = React.useState(false)

  async function handleDemote() {
    setWorking(true)
    try {
      await setUserRole(user.uid, "player")
      toast.success(`${user.displayName || user.email} ya no es admin.`)
      setOpen(false)
    } catch (err) {
      console.error("Error demoting admin:", err)
      toast.error("No se pudo cambiar el rol.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" disabled={disabled}>
            <Trash2Icon className="size-3.5" />
            Revocar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Revocar rol de admin?</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{user.displayName || user.email}</span>{" "}
            pasa a ser <strong>jugador</strong> normal. Pierde acceso a crear
            pozos, jugadores y grupos. Se puede volver a invitar después.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={working}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDemote}
            disabled={working}
          >
            {working ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Revocando…
              </>
            ) : (
              "Revocar admin"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* Registered clientes — promote to admin from a table                         */
/* -------------------------------------------------------------------------- */

function ClientesCard() {
  const { clientes, hydrated } = useClienteUsers()
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? clientes.filter(
          (c) =>
            c.email.includes(q) || c.displayName.toLowerCase().includes(q),
        )
      : clientes
    // Newest signups first — the person you just invited is who you're
    // most likely looking for.
    return [...base].sort((a, b) => b.createdAt - a.createdAt)
  }, [clientes, search])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersIcon className="size-4" />
          Clientes registrados
          {hydrated && clientes.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {clientes.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Cuentas con rol jugador. Desde acá los podés convertir en admin sin
          tipear su email.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!hydrated ? (
          <div className="px-6 pb-6">
            <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="px-6 pb-6 text-center">
            <Text variant="muted" className="text-sm">
              Todavía no hay clientes registrados.
            </Text>
          </div>
        ) : (
          <>
            <div className="px-6 pb-4">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por nombre o email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Buscar cliente"
                />
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="px-6 pb-6 text-center">
                <Text variant="muted" className="text-sm">
                  Ningún cliente coincide con la búsqueda.
                </Text>
              </div>
            ) : (
              <ClientesTable clientes={filtered} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ClientesTable({ clientes }: { clientes: UserProfile[] }) {
  return (
    <div className="overflow-hidden border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Usuario</TableHead>
            <TableHead className="hidden sm:table-cell">Registrado</TableHead>
            <TableHead className="pr-4 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((c) => (
            <TableRow key={c.uid}>
              <TableCell className="pl-4">
                <div className="flex flex-col leading-tight">
                  <span className="font-medium">{c.displayName || c.email}</span>
                  <span className="text-xs text-muted-foreground">{c.email}</span>
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {new Date(c.createdAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <PromoteClienteButton user={c} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PromoteClienteButton({ user }: { user: UserProfile }) {
  const [working, setWorking] = React.useState(false)

  async function handlePromote() {
    setWorking(true)
    try {
      await setUserRole(user.uid, "admin")
      toast.success(`${user.displayName || user.email} ahora es admin.`)
    } catch (err) {
      console.error("Error promoting cliente to admin:", err)
      toast.error("No se pudo cambiar el rol.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePromote}
      disabled={working}
      aria-label={`Hacer admin a ${user.displayName || user.email}`}
    >
      {working ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : (
        <ShieldPlusIcon className="size-3.5" />
      )}
      Hacer admin
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/* Signups toggle (existing feature, kept)                                     */
/* -------------------------------------------------------------------------- */

function SignupsToggleCard() {
  const { settings, hydrated } = useAppSettings()
  const [saving, setSaving] = React.useState(false)

  async function toggleSignups(next: boolean) {
    setSaving(true)
    try {
      await saveAppSettings({ signupsEnabled: next })
      toast.success(next ? "Registro habilitado" : "Registro deshabilitado")
    } catch (err) {
      console.error("Error toggling signups:", err)
      toast.error("No se pudo guardar el cambio")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlusIcon className="size-4" />
          Registro abierto
        </CardTitle>
        <CardDescription>
          Cuando está apagado, nadie puede crear cuentas nuevas — excepto los
          emails que están en la lista de invitaciones pendientes (esos
          siempre pueden registrarse, sea cual sea este toggle).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="signups" className="text-sm font-medium">
              Permitir creación de cuentas
            </Label>
            <p className="text-xs text-muted-foreground">
              {hydrated
                ? settings.signupsEnabled
                  ? "Actualmente cualquiera puede registrarse."
                  : "Solo emails invitados pueden registrarse."
                : "Cargando…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(saving || !hydrated) && (
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="signups"
              checked={settings.signupsEnabled}
              onCheckedChange={toggleSignups}
              disabled={saving || !hydrated}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

