import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  buildPlayerHistory,
  subscribePlayerPozos,
  type PlayerPozoStat,
} from "@/lib/player-stats"
import type { StandingsSort } from "@/lib/pozo/standings"
import type { Pozo } from "@/lib/pozo/types"

/**
 * A player's finished pozos as chart-ready stats. The subscription depends
 * only on who is looking and whose history it is; switching the ranking
 * metric re-derives positions from the pozos already in memory instead of
 * re-querying Firestore.
 */
export function usePlayerHistory(playerId: string, sort: StandingsSort) {
  const { user, isAdmin } = useAuth()
  const [pozos, setPozos] = React.useState<Pozo[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user || !playerId) {
      setPozos([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    return subscribePlayerPozos(
      { uid: user.uid, isAdmin },
      playerId,
      (list) => {
        setPozos(list)
        setHydrated(true)
      },
      (err) => {
        // A failed branch still renders whatever the other one returned;
        // this only makes sure the page never hangs on the skeleton.
        console.error("usePlayerHistory subscription error:", err)
        setHydrated(true)
      },
    )
  }, [user, isAdmin, playerId])

  const history = React.useMemo<PlayerPozoStat[]>(
    () => buildPlayerHistory(pozos, playerId, sort),
    [pozos, playerId, sort],
  )

  return { history, hydrated }
}
