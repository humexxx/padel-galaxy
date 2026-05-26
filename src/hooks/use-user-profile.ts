import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  DEFAULT_USER_PROFILE,
  subscribeUserProfile,
  type UserProfile,
} from "@/lib/user-profile"

/**
 * Subscribe to the current user's profile doc. Returns `null` for `profile`
 * while loading; once hydrated, returns either the stored doc or a fully
 * filled-in default (so the settings form always has values to render).
 */
export function useUserProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setProfile(null)
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribeUserProfile(user.uid, (p) => {
      // No profile doc yet → seed defaults using Firebase Auth's name + email.
      // The doc gets persisted on first edit (see saveUserProfile).
      if (p === null) {
        setProfile({
          ...DEFAULT_USER_PROFILE,
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "",
          createdAt: 0,
          updatedAt: 0,
        })
      } else {
        setProfile(p)
      }
      setHydrated(true)
    })
    return unsub
  }, [user])

  return { profile, hydrated }
}
