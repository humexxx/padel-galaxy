"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOutIcon } from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/pozos" className="flex items-center">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={handleLogout}
          >
            <LogOutIcon className="size-[1.1rem]" />
          </Button>
        </div>
      </div>
    </header>
  )
}
