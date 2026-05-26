import * as React from "react"

import { subscribeAdmins, type UserProfile } from "@/lib/user-profile"

/**
 * Stream of all users with role=admin or superadmin. Gated by Firestore
 * rules: only superadmin reads succeed. The caller (currently /admin) is
 * responsible for ensuring it's mounted under the right guard.
 */
export function useAdmins() {
  const [admins, setAdmins] = React.useState<UserProfile[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(false)
    const unsub = subscribeAdmins(
      (next) => {
        setAdmins(next)
        setHydrated(true)
      },
      (err) => {
        console.error("subscribeAdmins failed:", err)
        setHydrated(true)
      },
    )
    return unsub
  }, [])

  return { admins, hydrated }
}
