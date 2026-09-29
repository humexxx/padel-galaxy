import { Outlet, useLocation } from "react-router"

import { InstallAppBanner } from "@/components/install-app"
import { MobileTabBar } from "@/components/mobile-tab-bar"
import { PageTransition } from "@/components/page-transition"
import { SiteHeader } from "@/components/site-header"
import { StarsBackground } from "@/components/stars-background"
import { VerifyEmailBanner } from "@/components/verify-email-banner"
import { useNavItems } from "@/hooks/use-nav-items"

export function AppLayout() {
  const location = useLocation()
  const items = useNavItems()
  return (
    <StarsBackground className="flex min-h-svh flex-col">
      <SiteHeader items={items} />
      <VerifyEmailBanner />
      {/* Bottom padding clears the phone tab bar and the home indicator. */}
      <main className="flex-1 pb-[calc(3.25rem+env(safe-area-inset-bottom))] sm:pb-0">
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>
      <InstallAppBanner />
      <MobileTabBar items={items} />
    </StarsBackground>
  )
}
