import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  subscribePlayerHistory,
  type PlayerPozoStat,
} from "@/lib/player-stats"
import type { StandingsSort } from "@/lib/pozo/standings"

export function usePlayerHistory(playerId: string, sort: StandingsSort) {
  const { user } = useAuth()
  const [history, setHistory] = React.useState<PlayerPozoStat[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user || !playerId) {
      setHistory([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribePlayerHistory(
      user.uid,
      playerId,
      sort,
      (list) => {
        setHistory(list)
        setHydrated(true)
      },
    )
    return unsub
  }, [user, playerId, sort])

  return { history, hydrated }
}
