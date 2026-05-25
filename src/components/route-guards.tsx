import { Navigate, Outlet, useLocation } from "react-router"
import { Loader2Icon, ShieldAlertIcon } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"

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

export function RequireAdmin() {
  const { user, isAdmin, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlertIcon className="size-10 text-destructive" />
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Acceso restringido</h1>
          <p className="text-sm text-muted-foreground">
            Esta sección es solo para administradores.
          </p>
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
