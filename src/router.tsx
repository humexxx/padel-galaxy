import * as React from "react"
import { createBrowserRouter } from "react-router"
import { Loader2Icon } from "lucide-react"

import { RequireAdmin, RequireAuth, RequireSuperAdmin, RedirectIfAuthed } from "@/components/route-guards"

// AppLayout is tiny (just SiteHeader + PageTransition) and is on the critical
// path for every authenticated route — keep it eager so the chrome paints
// immediately while the route chunk is in flight.
import { AppLayout } from "@/routes/app-layout"

/**
 * Lazy-loaded routes. Each `lazyEl` call returns a wrapped React.lazy element
 * so React Router gets a real `element` (not a `lazy` prop, which RR7 doesn't
 * yet support on data routes without extra config).
 *
 * Splits chosen for max bundle impact:
 *   - LandingPage: only unauth users see it, no need to ship to authenticated.
 *   - /admin: superadmin-only — drops Switch/Dialog/Table/admin-invites lib
 *     out of the main bundle for everyone else.
 *   - /jugadores/:id + /grupos/:id: pull in recharts (~300 KB) — defer until
 *     the user actually opens a detail page.
 *   - /pozos/nuevo: heavy form with comboboxes + algorithm preview.
 *   - /settings: low-traffic, easy win.
 */
function lazyEl(loader: () => Promise<{ default: React.ComponentType }>) {
  const Comp = React.lazy(loader)
  return (
    <React.Suspense fallback={<RouteFallback />}>
      <Comp />
    </React.Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40svh] items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

const LandingPage = () =>
  import("@/routes/landing").then((m) => ({ default: m.LandingPage }))
const LoginPage = () =>
  import("@/routes/login").then((m) => ({ default: m.LoginPage }))
const PozosPage = () =>
  import("@/routes/pozos").then((m) => ({ default: m.PozosPage }))
const NuevoPozoPage = () =>
  import("@/routes/pozo-nuevo").then((m) => ({ default: m.NuevoPozoPage }))
const PozoDetailPage = () =>
  import("@/routes/pozo-detail").then((m) => ({ default: m.PozoDetailPage }))
const HistorialPage = () =>
  import("@/routes/historial").then((m) => ({ default: m.HistorialPage }))
const JugadoresPage = () =>
  import("@/routes/jugadores").then((m) => ({ default: m.JugadoresPage }))
const JugadorDetallePage = () =>
  import("@/routes/jugador-detalle").then((m) => ({
    default: m.JugadorDetallePage,
  }))
const GrupoDetallePage = () =>
  import("@/routes/grupo-detalle").then((m) => ({
    default: m.GrupoDetallePage,
  }))
const SettingsPage = () =>
  import("@/routes/settings").then((m) => ({ default: m.SettingsPage }))
const AdminPage = () =>
  import("@/routes/admin").then((m) => ({ default: m.AdminPage }))
const NotFoundPage = () =>
  import("@/routes/not-found").then((m) => ({ default: m.NotFoundPage }))

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RedirectIfAuthed>{lazyEl(LandingPage)}</RedirectIfAuthed>,
  },
  {
    path: "/login",
    element: <RedirectIfAuthed>{lazyEl(LoginPage)}</RedirectIfAuthed>,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/pozos", element: lazyEl(PozosPage) },
          { path: "/pozos/:id", element: lazyEl(PozoDetailPage) },
          // /jugadores/:id stays accessible to any auth user — the rule
          // gates per-record (owner / linked cliente / admin / pre-claim
          // invitee). The roster LIST below is admin-only because it's
          // the organizer's tool, not relevant for clientes.
          { path: "/jugadores/:id", element: lazyEl(JugadorDetallePage) },
          { path: "/pozos/grupos/:id", element: lazyEl(GrupoDetallePage) },
          // Legacy /grupos/:id route kept as a redirect target (not exposed).
          { path: "/grupos/:id", element: lazyEl(GrupoDetallePage) },
          { path: "/historial", element: lazyEl(HistorialPage) },
          { path: "/settings", element: lazyEl(SettingsPage) },
        ],
      },
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: "/pozos/nuevo", element: lazyEl(NuevoPozoPage) },
              // Roster list is an organizer tool. Clientes get "Mi perfil"
              // in the header instead, deep-linking to their own
              // /jugadores/:id detail.
              { path: "/jugadores", element: lazyEl(JugadoresPage) },
            ],
          },
        ],
      },
      {
        element: <RequireSuperAdmin />,
        children: [
          {
            element: <AppLayout />,
            children: [{ path: "/admin", element: lazyEl(AdminPage) }],
          },
        ],
      },
    ],
  },
  { path: "*", element: lazyEl(NotFoundPage) },
])
