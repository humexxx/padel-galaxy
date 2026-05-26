import { Outlet, useLocation } from "react-router"

import { PageTransition } from "@/components/page-transition"
import { SiteHeader } from "@/components/site-header"
import { StarsBackground } from "@/components/stars-background"

export function AppLayout() {
  const location = useLocation()
  return (
    <StarsBackground className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>
    </StarsBackground>
  )
}
