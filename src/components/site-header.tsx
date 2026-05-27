import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router"
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { BrandLogo, LogoMark } from "@/components/brand-logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { useMyPlayer } from "@/hooks/use-players"
import { usePozos } from "@/hooks/use-pozos"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  to: string
  matchPrefix?: string
}

function initialsFrom(name: string): string {
  return (
    name
      .split(/[ @.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "P"
  )
}

export function SiteHeader() {
  const location = useLocation()
  const { isAdmin, isSuperAdmin } = useAuth()
  const { pozos } = usePozos()
  // Used to render "Mi perfil" for cliente-tier users. Admins typically
  // aren't linked to a /players doc (they OWN the roster, they're not IN
  // it), so this returns null for them and we keep the wider "Jugadores"
  // link instead.
  const { player: myPlayer } = useMyPlayer()

  const activeCount = pozos.filter((p) => p.status !== "finished").length

  const items: NavItem[] = React.useMemo(() => {
    const base: NavItem[] = [
      { label: "Pozos", to: "/pozos", matchPrefix: "/pozos" },
    ]
    // Admins see the full roster page (/jugadores). Clientes only see
    // themselves — deep-link straight to their own /jugadores/:id detail.
    // A cliente without a linked record (e.g. signed up before any
    // invite reached them) gets no "perfil" link at all — they have
    // nothing to see there yet.
    if (isAdmin) {
      base.push({ label: "Jugadores", to: "/jugadores", matchPrefix: "/jugadores" })
    } else if (myPlayer) {
      base.push({
        label: "Mi perfil",
        to: `/jugadores/${myPlayer.id}`,
        matchPrefix: "/jugadores",
      })
    }
    base.push({ label: "Historial", to: "/historial" })
    // /admin is superadmin-only. Regular admins (if any) won't see the
    // link at all — they can't access the page either way (guard enforces).
    if (isSuperAdmin) base.push({ label: "Admin", to: "/admin" })
    return base
  }, [isAdmin, isSuperAdmin, myPlayer])

  function isActive(item: NavItem): boolean {
    if (item.matchPrefix) {
      return (
        location.pathname === item.matchPrefix ||
        location.pathname.startsWith(`${item.matchPrefix}/`)
      )
    }
    return location.pathname === item.to
  }

  function countFor(item: NavItem): number | undefined {
    // Only /pozos shows a count — it's an "active work" indicator. /historial
    // count would just grow forever and never be actionable.
    if (item.to === "/pozos" && activeCount > 0) return activeCount
    return undefined
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          to="/pozos"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          aria-label="Ir a Pozos"
        >
          <span className="hidden sm:inline-flex">
            <BrandLogo showWordmark={false} />
          </span>
          <span className="sm:hidden">
            <LogoMark className="size-8" />
          </span>
          <span className="hidden text-sm font-bold tracking-tight sm:inline">
            Padel Galaxy
          </span>
        </Link>

        <nav
          aria-label="Principal"
          className="flex items-center gap-0.5 text-sm sm:gap-1"
        >
          {items.map((item) => {
            const active = isActive(item)
            const count = countFor(item)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-medium transition-colors sm:px-3",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

function UserMenu() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { setTheme, theme } = useTheme()

  // Compute the display name even when user is null so the useMemo below
  // runs unconditionally (Rules of Hooks — never bail out before a hook).
  const name = user?.displayName || user?.email?.split("@")[0] || "Cuenta"
  const initials = React.useMemo(() => initialsFrom(name), [name])

  if (!user) return null

  const email = user.email ?? ""
  const photoURL = user.photoURL ?? ""

  async function handleLogout() {
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch {
      toast.error("No se pudo cerrar sesión")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="flex h-9 items-center gap-2 rounded-full px-1 pr-2 sm:pr-3"
            aria-label="Abrir menú de usuario"
          >
            <Avatar className="size-7">
              <AvatarImage src={photoURL} alt={name} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{name}</span>
            <ChevronsUpDownIcon className="hidden size-3.5 text-muted-foreground sm:inline" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56 rounded-lg">
        {/* Account header is purely visual — not a Menu.GroupLabel, because
            base-nova's GroupLabel must live inside a Menu.Group. A plain
            div is the right primitive for a non-interactive heading row. */}
        <div className="flex items-center gap-2 px-1.5 py-1.5 text-left text-sm">
          <Avatar className="size-8">
            <AvatarImage src={photoURL} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 leading-tight">
            <span className="truncate font-semibold">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/settings" />}>
            <SettingsIcon className="size-4" />
            Configuración
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Tema
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <SunIcon className="size-4" />
            Claro
            {theme === "light" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <MoonIcon className="size-4" />
            Oscuro
            {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <MonitorIcon className="size-4" />
            Sistema
            {theme === "system" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOutIcon className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
