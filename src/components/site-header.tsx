import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router"
import {
  ChevronsUpDownIcon,
  DownloadIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { BrandLogo, LogoMark } from "@/components/brand-logo"
import { InstallAppButton, InstallInstructions } from "@/components/install-app"
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
import { useInstallMenuEntry } from "@/hooks/use-install-action"
import { useMyPlayer } from "@/hooks/use-players"
import { usePozos } from "@/hooks/use-pozos"
import { cn } from "@/lib/utils"
import { versionDetail, versionLabel } from "@/lib/version"

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

/**
 * True while the horizontally-scrollable element still has content past its
 * right edge. Drives the fade that tells you the nav strip keeps going —
 * and stops fading once you've scrolled to the end, so the last item is
 * never dimmed for no reason.
 */
function useHasScrollRight(
  ref: React.RefObject<HTMLElement | null>,
  /** Re-measures when the item count changes — the admin flags resolve
   *  after the first paint, so the strip grows a beat late. */
  itemCount: number,
): boolean {
  const [hasMore, setHasMore] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () =>
      setHasMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
    check()
    el.addEventListener("scroll", check, { passive: true })
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => {
      el.removeEventListener("scroll", check)
      observer.disconnect()
    }
  }, [ref, itemCount])
  return hasMore
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
    // "Clases" is the organizer's lesson agenda — admin-only, same as the
    // route guard, so a cliente never sees a link they can't follow.
    //
    // Admins see the full roster page (/jugadores) — plural, "Jugadores".
    // Clientes get the singular "Jugador" that deep-links straight to
    // their own /jugadores/:id detail. The label switch is intentional:
    // a cliente has nothing to look at besides themselves, so the plural
    // would mis-promise a list view they can't access.
    //
    // A cliente without a linked record (e.g. signed up before any
    // invite reached them) gets no "Jugador" link at all — there's
    // nothing to link TO yet.
    if (isAdmin) {
      base.push({ label: "Clases", to: "/clases" })
      base.push({ label: "Jugadores", to: "/jugadores", matchPrefix: "/jugadores" })
    } else if (myPlayer) {
      base.push({
        label: "Jugador",
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

  const navRef = React.useRef<HTMLElement>(null)
  const hasScrollRight = useHasScrollRight(navRef, items.length)

  // On a phone the strip is wider than the screen, so the page you're on
  // can start out scrolled past the edge. Pull it back into view whenever
  // the route changes.
  React.useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" })
  }, [location.pathname, items.length])

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

        {/* Scrolls sideways instead of squeezing the account menu: an admin
            carries five destinations and they don't fit across a 375 px
            phone. `min-w-0` lets the strip shrink, the scrollbar is hidden
            (it would sit on top of the labels), and the trailing fade is
            what's left to say "keep swiping". */}
        <nav
          ref={navRef}
          aria-label="Principal"
          className={cn(
            "flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden",
            hasScrollRight &&
              "[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)]",
          )}
        >
          {items.map((item) => {
            const active = isActive(item)
            const count = countFor(item)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium transition-colors sm:px-3",
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
          <InstallAppButton className="hidden sm:inline-flex" />
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
  // Permanent home for the install action. On phones the header button is
  // hidden and the banner can be dismissed for good, so without this entry
  // there'd be no way back to installing.
  const install = useInstallMenuEntry()

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
          {install.available && (
            <DropdownMenuItem onClick={install.trigger}>
              <DownloadIcon className="size-4" />
              Instalar app
            </DropdownMenuItem>
          )}
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
        <DropdownMenuSeparator />
        {/* Not a menu item: it's a label, nothing happens when you click it.
            Lives here so "which build am I on?" is answerable from any page
            without digging into settings. */}
        <p
          className="px-2 py-1.5 text-center font-mono text-[10px] text-muted-foreground"
          title={versionDetail()}
        >
          {versionLabel}
        </p>
      </DropdownMenuContent>
      <InstallInstructions
        state={install.state}
        open={install.showIosHelp}
        onOpenChange={install.setShowIosHelp}
      />
    </DropdownMenu>
  )
}
