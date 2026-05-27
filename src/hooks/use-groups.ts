import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  subscribeAllGroups,
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
    // Super-admin sees every group in the system. Regular users see only
    // the ones they own. The Firestore read rule allows `isAdmin` reads
    // on any /groups doc, so the broader query is safe — see
    // `subscribeAllGroups` for the rationale.
    const unsub = isSuperAdmin
      ? subscribeAllGroups((list) => {
          setGroups(list)
          setHydrated(true)
        })
      : subscribeUserGroups(user.uid, (list) => {
          setGroups(list)
          setHydrated(true)
        })
    return unsub
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
