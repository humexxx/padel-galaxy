import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import { subscribeGroupPozos } from "@/lib/group-stats"
import type { Pozo } from "@/lib/pozo/types"

export function useGroupPozos(groupId: string) {
  const { user } = useAuth()
  const [pozos, setPozos] = React.useState<Pozo[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user || !groupId) {
      setPozos([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribeGroupPozos(user.uid, groupId, (list) => {
      setPozos(list)
      setHydrated(true)
    })
    return unsub
  }, [user, groupId])

  return { pozos, hydrated }
}
