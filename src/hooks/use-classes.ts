import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  subscribeAllClasses,
  subscribeOwnerClasses,
  type ClassRecord,
} from "@/lib/classes"

/**
 * The organizer's class agenda. Mirrors `usePozos`: a superadmin sees every
 * class in the system, everyone else sees the ones they scheduled. The page
 * that uses this is admin-gated, so a cliente never gets here.
 */
export function useClasses() {
  const { user, isSuperAdmin } = useAuth()
  const [classes, setClasses] = React.useState<ClassRecord[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setClasses([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    const onData = (list: ClassRecord[]) => {
      setClasses(list)
      setHydrated(true)
    }
    const onError = (err: Error) => {
      // A missing composite index or a denied read shouldn't leave the page
      // spinning forever — show the empty state and log the reason.
      console.error("useClasses subscription error:", err)
      setClasses([])
      setHydrated(true)
    }
    return isSuperAdmin
      ? subscribeAllClasses(onData, onError)
      : subscribeOwnerClasses(user.uid, onData, onError)
  }, [user, isSuperAdmin])

  return { classes, hydrated }
}
