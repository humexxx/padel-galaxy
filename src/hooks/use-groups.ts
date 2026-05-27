import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  subscribeAllGroups,
  subscribeParticipantGroups,
  subscribeUserGroups,
  type GroupRecord,
} from "@/lib/groups"

export function useGroups() {
  const { user, isSuperAdmin } = useAuth()
  const [groups, setGroups] = React.useState<GroupRecord[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setGroups([])
      setHydrated(true)
      return
    }
    setHydrated(false)

    // Super-admin sees every group in the system via a single broad
    // query — rules already allow `isAdmin` reads on any /groups doc.
    if (isSuperAdmin) {
      const unsub = subscribeAllGroups((list) => {
        setGroups(list)
        setHydrated(true)
      })
      return unsub
    }

    // Everyone else gets the union of "groups I own" + "groups I'm a
    // participant in" (denormalized via `participantUids`). Most
    // clientes own none and participate in some; most organizers own
    // some and participate in zero. The merge handles both cleanly.
    //
    // Two listeners + client-side dedup by id. We can't OR two
    // where-clauses in a single Firestore query without composite
    // workarounds, and the extra listener is cheap at this scale.
    let owned: GroupRecord[] = []
    let participant: GroupRecord[] = []
    let ownedReady = false
    let participantReady = false
    const flush = () => {
      const byId = new Map<string, GroupRecord>()
      for (const g of owned) byId.set(g.id, g)
      for (const g of participant) if (!byId.has(g.id)) byId.set(g.id, g)
      const merged = [...byId.values()].sort((a, b) =>
        a.nameLower.localeCompare(b.nameLower),
      )
      setGroups(merged)
      if (ownedReady && participantReady) setHydrated(true)
    }
    const unsubOwned = subscribeUserGroups(
      user.uid,
      (list) => {
        owned = list
        ownedReady = true
        flush()
      },
      (err) => {
        // Surface errors so the hook doesn't get stuck "loading forever"
        // when a rule mismatch silently rejects the listener — instead
        // we mark the branch ready with an empty list and the empty
        // state renders.
        console.error("subscribeUserGroups failed:", err)
        owned = []
        ownedReady = true
        flush()
      },
    )
    const unsubParticipant = subscribeParticipantGroups(
      user.uid,
      (list) => {
        participant = list
        participantReady = true
        flush()
      },
      (err) => {
        console.error("subscribeParticipantGroups failed:", err)
        participant = []
        participantReady = true
        flush()
      },
    )
    return () => {
      unsubOwned()
      unsubParticipant()
    }
  }, [user, isSuperAdmin])

  return { groups, hydrated }
}

export function useGroup(id: string) {
  const { groups, hydrated } = useGroups()
  const group = React.useMemo(
    () => groups.find((g) => g.id === id) ?? null,
    [groups, id],
  )
  return { group, hydrated }
}
