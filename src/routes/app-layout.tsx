import { Outlet, useLocation } from "react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { MobileTopBar } from "@/components/mobile-top-bar"
import { PageTransition } from "@/components/page-transition"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppLayout() {
  const location = useLocation()
  return (
    <TooltipProvider delay={200}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex min-h-svh flex-col">
          <MobileTopBar />
          <main className="flex-1">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
