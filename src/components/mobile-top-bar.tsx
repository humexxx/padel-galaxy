import { Link } from "react-router"

import { BrandLogo } from "@/components/brand-logo"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:hidden">
      <SidebarTrigger aria-label="Abrir menú" />
      <Link to="/pozos" className="flex items-center">
        <BrandLogo />
      </Link>
    </header>
  )
}
