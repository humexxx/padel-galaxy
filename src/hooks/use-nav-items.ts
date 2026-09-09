import * as React from "react"
import { useLocation } from "react-router"
import {
  CalendarDaysIcon,
  HistoryIcon,
  ShieldIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { useMyPlayer } from "@/hooks/use-players"
import { usePozos } from "@/hooks/use-pozos"

export type NavItem = {
  label: string
  to: string
  icon: LucideIcon
  active: boolean
  /** Only /pozos carries one — an "active work" indicator. */
  count?: number
}

/**
 * The app's destinations, resolved for the current user and route. One
 * hook feeding both the desktop header and the phone tab bar, so the two
 * can never disagree about what's on the menu — and so the Firestore
 * listeners behind it (pozos, linked player) run once per layout, not
 * once per nav.
 */
export function useNavItems(): NavItem[] {
  const location = useLocation()
  const { isAdmin, isSuperAdmin } = useAuth()
  const { pozos } = usePozos()
  // Admins own the roster but aren't in it, so this is null for them and
  // they get the full "Jugadores" list instead of "Jugador".
  const { player: myPlayer } = useMyPlayer()

  const activeCount = pozos.filter((p) => p.status !== "finished").length

  return React.useMemo(() => {
    const base: { label: string; to: string; icon: LucideIcon; matchPrefix?: string }[] = [
      { label: "Pozos", to: "/pozos", icon: TrophyIcon, matchPrefix: "/pozos" },
    ]
    // Clases and the roster list are organizer tools — same gate as the
    // route guards, so a cliente never sees a link they can't follow. A
    // cliente gets the singular "Jugador" deep-linked to their own record,
    // and nothing at all until an invite has linked one.
    if (isAdmin) {
      base.push({ label: "Clases", to: "/clases", icon: CalendarDaysIcon })
      base.push({ label: "Jugadores", to: "/jugadores", icon: UsersIcon, matchPrefix: "/jugadores" })
    } else if (myPlayer) {
      base.push({
        label: "Jugador",
        to: `/jugadores/${myPlayer.id}`,
        icon: UserIcon,
        matchPrefix: "/jugadores",
      })
    }
    base.push({ label: "Historial", to: "/historial", icon: HistoryIcon })
    if (isSuperAdmin) base.push({ label: "Admin", to: "/admin", icon: ShieldIcon })

    return base.map(({ matchPrefix, ...item }) => ({
      ...item,
      active: matchPrefix
        ? location.pathname === matchPrefix ||
          location.pathname.startsWith(`${matchPrefix}/`)
        : location.pathname === item.to,
      count: item.to === "/pozos" && activeCount > 0 ? activeCount : undefined,
    }))
  }, [isAdmin, isSuperAdmin, myPlayer, location.pathname, activeCount])
}
