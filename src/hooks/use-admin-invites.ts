import * as React from "react"

import { subscribeInvites, type AdminInvite } from "@/lib/admin-invites"

/**
 * Subscribe to all pending admin invites. Only useful inside /admin (the
 * Firestore rules forbid reads for non-superadmin), but the hook itself
 * doesn't check — the caller is responsible for gating render.
 */
export function useAdminInvites() {
  const [invites, setInvites] = React.useState<AdminInvite[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(false)
    const unsub = subscribeInvites(
      (next) => {
        setInvites(next)
        setHydrated(true)
      },
      (err) => {
        console.error("subscribeInvites failed:", err)
        setHydrated(true)
      },
    )
    return unsub
  }, [])

  return { invites, hydrated }
}
