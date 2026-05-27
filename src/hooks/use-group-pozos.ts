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
    // Admins (regular or super) usually OWN the group's pozos, so the
    // owner-filtered query is the cheapest path and matches the
    // existing composite index `(ownerId, groupId, createdAt)`. A
    // cliente who only PARTICIPATES in pozos here would get 0 results
    // from that query — they can't satisfy the ownerId filter — so
    // they go through the participant-filtered variant instead.
    //
    // Known limitation: an admin viewing a group they don't own will
    // see 0 pozos here. Out of scope for this fix; can be addressed
    // later with a `(groupId, createdAt)` composite index.
    const onData = (list: Pozo[]) => {
      setPozos(list)
      setHydrated(true)
    }
    const unsub = isAdmin
      ? subscribeGroupPozos(user.uid, groupId, onData, (err) => {
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
