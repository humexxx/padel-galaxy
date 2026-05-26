import { createBrowserRouter } from "react-router"

import { AppLayout } from "@/routes/app-layout"
import { LandingPage } from "@/routes/landing"
import { LoginPage } from "@/routes/login"
import { PozosPage } from "@/routes/pozos"
import { NuevoPozoPage } from "@/routes/pozo-nuevo"
import { PozoDetailPage } from "@/routes/pozo-detail"
import { HistorialPage } from "@/routes/historial"
import { JugadoresPage } from "@/routes/jugadores"
import { JugadorDetallePage } from "@/routes/jugador-detalle"
import { GrupoDetallePage } from "@/routes/grupo-detalle"
import { SettingsPage } from "@/routes/settings"
import { AdminPage } from "@/routes/admin"
import { NotFoundPage } from "@/routes/not-found"
import { RequireAuth, RequireSuperAdmin, RedirectIfAuthed } from "@/components/route-guards"

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RedirectIfAuthed>
        <LandingPage />
      </RedirectIfAuthed>
    ),
  },
  {
    path: "/login",
    element: (
      <RedirectIfAuthed>
        <LoginPage />
      </RedirectIfAuthed>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/pozos", element: <PozosPage /> },
          { path: "/pozos/nuevo", element: <NuevoPozoPage /> },
          { path: "/pozos/:id", element: <PozoDetailPage /> },
          { path: "/jugadores", element: <JugadoresPage /> },
          { path: "/jugadores/:id", element: <JugadorDetallePage /> },
          { path: "/pozos/grupos/:id", element: <GrupoDetallePage /> },
          // Legacy /grupos/:id route kept as a redirect target (not exposed).
          { path: "/grupos/:id", element: <GrupoDetallePage /> },
          { path: "/historial", element: <HistorialPage /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
      {
        element: <RequireSuperAdmin />,
        children: [
          {
            element: <AppLayout />,
            children: [{ path: "/admin", element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
