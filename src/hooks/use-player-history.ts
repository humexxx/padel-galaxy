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
      // Belt-and-suspenders: subscribePlayerHistory already swallows its own
      // per-query errors and flushes empty results, but if it ever surfaces
      // one we still want hydrated=true so the page renders the empty state
      // instead of hanging on the loading skeleton forever.
      (err) => {
        console.error("usePlayerHistory subscription error:", err)
        setHistory([])
        setHydrated(true)
      },
    )
    return unsub
  }, [user, playerId, sort])

  return { history, hydrated }
}
