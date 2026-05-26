import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import { subscribeUserPlayers, type PlayerRecord } from "@/lib/players"

export function usePlayers() {
  const { user } = useAuth()
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setPlayers([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribeUserPlayers(user.uid, (list) => {
      setPlayers(list)
      setHydrated(true)
    })
    return unsub
  }, [user])

  return { players, hydrated }
}

/**
 * Single-player accessor backed by the same roster subscription. Cheap because
 * the roster is already streamed; we just `.find()` into it. Returns null
 * (after hydration) if the id doesn't match anyone in this owner's roster.
 */
export function usePlayer(id: string) {
  const { players, hydrated } = usePlayers()
  const player = React.useMemo(
    () => players.find((p) => p.id === id) ?? null,
    [players, id],
  )
  return { player, hydrated }
}
