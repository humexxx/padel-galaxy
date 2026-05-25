import { createBrowserRouter } from "react-router"

import { AppLayout } from "@/routes/app-layout"
import { LandingPage } from "@/routes/landing"
import { LoginPage } from "@/routes/login"
import { PozosPage } from "@/routes/pozos"
import { NuevoPozoPage } from "@/routes/pozo-nuevo"
import { PozoDetailPage } from "@/routes/pozo-detail"
import { AdminPage } from "@/routes/admin"
import { NotFoundPage } from "@/routes/not-found"
import { RequireAuth, RequireAdmin, RedirectIfAuthed } from "@/components/route-guards"

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
        ],
      },
      {
        element: <RequireAdmin />,
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
