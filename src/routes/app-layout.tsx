import { Outlet, useLocation } from "react-router"

import { PageTransition } from "@/components/page-transition"
import { SiteHeader } from "@/components/site-header"

export function AppLayout() {
  const location = useLocation()
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  )
}
