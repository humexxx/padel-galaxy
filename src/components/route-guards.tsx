import { Link, Navigate, Outlet, useLocation, useSearchParams } from "react-router"
import { Loader2Icon, ShieldAlertIcon } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { safeNextPath } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Heading, Text } from "@/components/ui/typography"

function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

function Restricted({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlertIcon className="size-10 text-destructive" />
      <div className="space-y-1">
        <Heading level="h3" as="h1">Acceso restringido</Heading>
        <Text variant="muted">{message}</Text>
      </div>
      <Button asChild variant="outline">
        <Link to="/pozos">Volver a pozos</Link>
      </Button>
    </div>
  )
}

/** Admin OR superadmin. Clientes get the "restricted" view instead. */
export function RequireAdmin() {
  const { user, isAdmin, loading, roleLoading } = useAuth()

  if (loading || roleLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) {
    return (
      <Restricted message="Esta sección es para los organizadores. Si necesitás permisos, pedíselos a quien administra el grupo." />
    )
  }
  return <Outlet />
}

/** Only the top tier: /admin and anything that manages other admins. */
export function RequireSuperAdmin() {
  const { user, isSuperAdmin, loading, roleLoading } = useAuth()

  if (loading || roleLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin) {
    return (
      <Restricted message="Esta sección es solo para superadmin. Si necesitás acceso, pedíselo a quien tenga la cuenta principal." />
    )
  }
  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()
  if (loading) return <FullPageSpinner />
  // Honor ?next= here too: signing in flips `user` before the login form's
  // own navigate runs, and this redirect would otherwise win the race.
  if (user) {
    return <Navigate to={safeNextPath(searchParams.get("next")) ?? "/pozos"} replace />
  }
  return <>{children}</>
}
