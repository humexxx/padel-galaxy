import { Link, useNavigate } from "react-router"
import { LogOutIcon, ShieldIcon } from "lucide-react"
import { toast } from "sonner"

import { BrandLogo } from "@/components/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

export function SiteHeader() {
  const navigate = useNavigate()
  const { isAdmin, signOut } = useAuth()

  async function handleLogout() {
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch {
      toast.error("No se pudo cerrar sesión")
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link to="/pozos" className="flex items-center">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button asChild variant="ghost" size="icon" aria-label="Admin">
              <Link to="/admin">
                <ShieldIcon className="size-[1.1rem]" />
              </Link>
            </Button>
          )}
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
