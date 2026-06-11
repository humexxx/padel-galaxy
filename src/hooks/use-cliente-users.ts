import * as React from "react"

import { subscribeClienteUsers, type UserProfile } from "@/lib/user-profile"

/**
 * Stream of all player-tier users ("clientes"). Gated by Firestore rules:
 * only admin-tier reads succeed. The caller (currently /admin) is
 * responsible for ensuring it's mounted under the right guard.
 */
export function useClienteUsers() {
  const [clientes, setClientes] = React.useState<UserProfile[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(false)
    const unsub = subscribeClienteUsers(
      (next) => {
        setClientes(next)
        setHydrated(true)
      },
      (err) => {
        console.error("subscribeClienteUsers failed:", err)
        setHydrated(true)
      },
    )
    return unsub
  }, [])

  return { clientes, hydrated }
}
