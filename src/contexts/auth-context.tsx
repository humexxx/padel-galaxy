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
import { getAppSettings } from "@/lib/settings"

export class SignupsDisabledError extends Error {
  constructor() {
    super("El registro de cuentas está deshabilitado.")
    this.name = "SignupsDisabledError"
  }
}

export type AuthState = {
  user: User | null
  isAdmin: boolean
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
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (next) => {
      setUser(next)
      if (next) {
        const token = await next.getIdTokenResult()
        setIsAdmin(token.claims.admin === true)
      } else {
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const refreshClaims = React.useCallback(async () => {
    if (!auth.currentUser) return
    const token = await auth.currentUser.getIdTokenResult(true)
    setIsAdmin(token.claims.admin === true)
  }, [])

  const signInWithEmail = React.useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signUpWithEmail = React.useCallback(
    async (email: string, password: string, displayName?: string) => {
      const settings = await getAppSettings()
      if (!settings.signupsEnabled) throw new SignupsDisabledError()
      const cred = await createUserWithEmailAndPassword(auth, email, password)
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
      try {
        await cred.user.delete()
      } catch (err) {
        console.error("Failed to roll back disallowed signup:", err)
        await fbSignOut(auth)
      }
      throw new SignupsDisabledError()
    }
  }, [])

  const signOut = React.useCallback(async () => {
    await fbSignOut(auth)
  }, [])

  const value = React.useMemo<AuthState>(
    () => ({
      user,
      isAdmin,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      refreshClaims,
    }),
    [user, isAdmin, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, refreshClaims],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
