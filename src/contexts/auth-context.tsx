import * as React from "react"
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth"

import { auth } from "@/lib/firebase"
import { findInvite } from "@/lib/admin-invites"
import { findInvitedPlayer } from "@/lib/invites"
import { getAppSettings } from "@/lib/settings"
import {
  ensureUserProfile,
  subscribeUserProfile,
  type UserRole,
} from "@/lib/user-profile"

export class SignupsDisabledError extends Error {
  constructor() {
    super("El registro de cuentas está deshabilitado.")
    this.name = "SignupsDisabledError"
  }
}

export type AuthState = {
  user: User | null
  /** True if the user can do admin things (admin OR superadmin). */
  isAdmin: boolean
  /** True ONLY for the top tier — manage other admins, /admin access. */
  isSuperAdmin: boolean
  /** The user's role from their `/users/{uid}` doc, or null while loading. */
  role: UserRole | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshClaims: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  // Claim-derived flags. These come from the JWT and authorize the user
  // EVEN IF the Firestore doc hasn't loaded yet — important so e.g. the
  // /admin guard doesn't bounce a superadmin on first paint.
  const [claimAdmin, setClaimAdmin] = React.useState(false)
  const [claimSuperAdmin, setClaimSuperAdmin] = React.useState(false)
  const [docRole, setDocRole] = React.useState<UserRole | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Listen to auth state. On every sign-in we also call ensureUserProfile —
  // it's idempotent, so re-runs across page loads are cheap (single read +
  // maybe a single write if mirrored fields drifted).
  React.useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (next) => {
      setUser(next)
      if (next) {
        const token = await next.getIdTokenResult()
        const claims = {
          admin: token.claims.admin === true,
          superadmin: token.claims.superadmin === true,
        }
        setClaimAdmin(claims.admin)
        setClaimSuperAdmin(claims.superadmin)
        // Fire-and-forget — the subscription below will pick up the role
        // change once the doc is written. Errors logged but not thrown,
        // since they shouldn't block sign-in.
        ensureUserProfile({
          uid: next.uid,
          email: next.email ?? "",
          displayName: next.displayName ?? "",
          // Passed through so deriveInitialRole can avoid trying to create
          // a doc with role='admin' for an unverified email — the firestore
          // rule would reject it and we'd land in a no-doc-no-role state.
          emailVerified: next.emailVerified,
          claims,
        }).catch((err) => console.error("ensureUserProfile failed:", err))
      } else {
        setClaimAdmin(false)
        setClaimSuperAdmin(false)
        setDocRole(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // Subscribe to the user's profile doc to track role changes in real
  // time (e.g. superadmin promotes them in another tab → role updates
  // here without a refresh).
  React.useEffect(() => {
    if (!user) {
      setDocRole(null)
      return
    }
    const unsub = subscribeUserProfile(user.uid, (profile) => {
      setDocRole(profile?.role ?? null)
    })
    return unsub
  }, [user])

  const refreshClaims = React.useCallback(async () => {
    if (!auth.currentUser) return
    const token = await auth.currentUser.getIdTokenResult(true)
    setClaimAdmin(token.claims.admin === true)
    setClaimSuperAdmin(token.claims.superadmin === true)
  }, [])

  const signInWithEmail = React.useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signUpWithEmail = React.useCallback(
    async (email: string, password: string, displayName?: string) => {
      const settings = await getAppSettings()
      // Create the user first — both invite checks (admin + player) require
      // auth context to read Firestore. We delete the account after the
      // fact if it turns out the user wasn't allowed in. The Auth API
      // doesn't give us a "dry run" mode, so this is the cleanest path.
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (!settings.signupsEnabled) {
        const allowed = await hasAnyInvite(cred.user.email ?? "")
        if (!allowed) {
          await rollbackUser(cred.user)
          throw new SignupsDisabledError()
        }
      }
      if (displayName) await updateProfile(cred.user, { displayName })
    },
    [],
  )

  const signInWithGoogle = React.useCallback(async () => {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: "select_account" })
    const settings = await getAppSettings()
    const cred = await signInWithPopup(auth, provider)
    const info = getAdditionalUserInfo(cred)
    if (info?.isNewUser && !settings.signupsEnabled) {
      // Last-chance check: this email might have an admin or player invite.
      // If neither, roll back the freshly-created Auth user.
      const allowed = await hasAnyInvite(cred.user.email ?? "")
      if (!allowed) {
        await rollbackUser(cred.user)
        throw new SignupsDisabledError()
      }
    }
  }, [])

  const signOut = React.useCallback(async () => {
    await fbSignOut(auth)
  }, [])

  // Effective admin/superadmin: claim wins, doc fills in the gap. This
  // ordering means a superadmin claim grants admin even if the doc
  // hasn't loaded yet (avoids permission flicker).
  const isSuperAdmin = claimSuperAdmin || docRole === "superadmin"
  const isAdmin = claimAdmin || claimSuperAdmin || docRole === "admin" || docRole === "superadmin"
  // Surface a single canonical role — prefer the doc (source of truth)
  // but fall back to claim while the doc loads.
  const role: UserRole | null = docRole ?? (
    claimSuperAdmin ? "superadmin" : claimAdmin ? "admin" : null
  )

  const value = React.useMemo<AuthState>(
    () => ({
      user,
      isAdmin,
      isSuperAdmin,
      role,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      refreshClaims,
    }),
    [
      user,
      isAdmin,
      isSuperAdmin,
      role,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      refreshClaims,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}

/**
 * True if `email` is allowed to register even when the global signups
 * toggle is OFF. Two reasons we'd allow:
 *
 *   1. There's a pending `adminInvites/{email}` doc — superadmin invited
 *      this person to become an admin.
 *   2. There's a `players/{playerId}` doc with matching invitedEmail —
 *      an organizer invited this person to claim a player record.
 *
 * Both checks run in parallel for speed (Promise.all) since each is a
 * single round trip.
 */
async function hasAnyInvite(email: string): Promise<boolean> {
  if (!email) return false
  const [adminInv, playerInv] = await Promise.all([
    findInvite(email).catch(() => null),
    findInvitedPlayer(email).catch(() => null),
  ])
  return Boolean(adminInv || playerInv)
}

/**
 * Delete the just-created auth user when we decide they shouldn't have
 * been allowed in. Falls back to signing out if delete fails (so we at
 * least don't leave them in a half-signed-in state).
 */
async function rollbackUser(user: User): Promise<void> {
  try {
    await user.delete()
  } catch (err) {
    console.error("Failed to roll back disallowed signup:", err)
    await fbSignOut(auth)
  }
}
