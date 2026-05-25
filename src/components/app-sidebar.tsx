import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router"
import {
  ClockIcon,
  LogOutIcon,
  PlusIcon,
  ShieldIcon,
  TrophyIcon,
} from "lucide-react"
import { toast } from "sonner"

import { BrandLogo, LogoMark } from "@/components/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { usePozos } from "@/hooks/use-pozos"

type NavItem = {
  label: string
  to: string
  icon: typeof TrophyIcon
}

const NAV_ITEMS: NavItem[] = [
  { label: "Pozos", to: "/pozos", icon: TrophyIcon },
  { label: "Historial", to: "/historial", icon: ClockIcon },
]

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, signOut } = useAuth()
  const { pozos } = usePozos()

  const activeCount = pozos.filter((p) => p.status !== "finished").length
  const finishedCount = pozos.filter((p) => p.status === "finished").length

  async function handleLogout() {
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch {
      toast.error("No se pudo cerrar sesión")
    }
  }

  const initials = React.useMemo(() => {
    const name = user?.displayName || user?.email || ""
    return (
      name
        .split(/[ @.]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "P"
    )
  }, [user?.displayName, user?.email])

  function isActive(to: string) {
    if (to === "/pozos") {
      return location.pathname === "/pozos" || location.pathname.startsWith("/pozos/")
    }
    return location.pathname === to
  }

  function badgeFor(to: string) {
    if (to === "/pozos") return activeCount > 0 ? activeCount : undefined
    if (to === "/historial") return finishedCount > 0 ? finishedCount : undefined
    return undefined
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/pozos" />}>
              <LogoMark className="size-8 shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="font-semibold">Padel Galaxy</span>
                <span className="text-xs text-muted-foreground">Pozos</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/pozos/nuevo" />}
                  tooltip="Crear pozo"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                >
                  <PlusIcon />
                  <span>Crear pozo</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const badge = badgeFor(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={isActive(item.to)}
                      tooltip={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {badge !== undefined && (
                      <SidebarMenuBadge>{badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to="/admin" />}
                    isActive={location.pathname === "/admin"}
                    tooltip="Panel admin"
                  >
                    <ShieldIcon />
                    <span>Panel</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={user?.email ?? undefined}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">
                  {user?.displayName || "Cuenta"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-1 px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={handleLogout}
          >
            <LogOutIcon />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

// Re-export the BrandLogo for use in other places.
export { BrandLogo }
