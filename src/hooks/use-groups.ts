import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import { subscribeUserGroups, type GroupRecord } from "@/lib/groups"

export function useGroups() {
  const { user } = useAuth()
  const [groups, setGroups] = React.useState<GroupRecord[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setGroups([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribeUserGroups(user.uid, (list) => {
      setGroups(list)
      setHydrated(true)
    })
    return unsub
  }, [user])

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
