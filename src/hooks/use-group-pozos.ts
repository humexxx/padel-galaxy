import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  subscribeGroupPozos,
  subscribeParticipantGroupPozos,
} from "@/lib/group-stats"
import type { Pozo } from "@/lib/pozo/types"

export function useGroupPozos(groupId: string) {
  const { user, isAdmin } = useAuth()
  const [pozos, setPozos] = React.useState<Pozo[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user || !groupId) {
      setPozos([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    // Admins can read every pozo, so they get the whole group whoever ran
    // each pozo. A cliente can only read the pozos they played in, so they
    // go through the participant query and filter by group in memory.
    const onData = (list: Pozo[]) => {
      setPozos(list)
      setHydrated(true)
    }
    const unsub = isAdmin
      ? subscribeGroupPozos(groupId, onData, (err) => {
          console.error("subscribeGroupPozos failed:", err)
          setPozos([])
          setHydrated(true)
        })
      : subscribeParticipantGroupPozos(user.uid, groupId, onData, (err) => {
          console.error("subscribeParticipantGroupPozos failed:", err)
          setPozos([])
          setHydrated(true)
        })
    return unsub
  }, [user, isAdmin, groupId])

  return { pozos, hydrated }
}
