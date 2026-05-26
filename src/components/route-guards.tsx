import { Navigate, Outlet, useLocation } from "react-router"
import { Loader2Icon, ShieldAlertIcon } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
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

/**
 * Strict gate: only the top tier gets in. Used for /admin and any
 * future destructive operations (delete users, change billing, etc).
 * A wider `RequireAdmin` (admin OR superadmin) lived here but was
 * never wired up — restore from git history if needed.
 */
export function RequireSuperAdmin() {
  const { user, isSuperAdmin, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin) {
    return (
      <div className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlertIcon className="size-10 text-destructive" />
        <div className="space-y-1">
          <Heading level="h3" as="h1">Acceso restringido</Heading>
          <Text variant="muted">
            Esta sección es solo para superadmin. Si necesitás acceso, pedíselo
            a quien tenga la cuenta principal.
          </Text>
        </div>
        <Button asChild variant="outline">
          <a href="/pozos">Volver a pozos</a>
        </Button>
      </div>
    )
  }
  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (user) return <Navigate to="/pozos" replace />
  return <>{children}</>
}
