import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore"

import { findInvite, deleteInvite } from "@/lib/admin-invites"
import { normalizeEmail } from "@/lib/email"
import { db } from "@/lib/firebase"
import { findInvitedPlayer, linkInvitedPlayer } from "@/lib/invites"

// Re-export so existing callers that imported `normalizeEmail` from this
// module keep working without touching every call site.
export { normalizeEmail }

const COLLECTION = "users"

/**
 * Padel-specific preference for which side of the court a player likes to
 * play. "drive" = forehand side, "reves" = backhand side. "any" leaves it
 * unspecified so they can be placed wherever the pairing algorithm needs.
 */
export type PreferredSide = "drive" | "reves" | "any"

export const PREFERRED_SIDE_LABELS: Record<PreferredSide, string> = {
  drive: "Drive (derecha)",
  reves: "Revés (izquierda)",
  any: "Cualquiera",
}

/**
 * Authorization tier. Note that `superadmin` is also marked with a custom
 * claim (set via scripts/set-superadmin.mjs) — the role field is the
 * source of truth for admins, but security rules also accept the claim
 * for resilience (e.g. if a doc read fails, the claim still authorizes).
 *
 * - `superadmin` — bootstrapped via script; only one (you). Manages other admins.
 * - `admin` — can create pozos / players / groups (same as legacy "admin").
 * - `player` — read-only, sees only what they're linked to (Phase B feature).
 */
export type UserRole = "superadmin" | "admin" | "player"

/**
 * Profile doc stored at `/users/{uid}`. `displayName` and `email` are
 * mirrored from Firebase Auth so the admin page can render a users table
 * without having to call auth.getUser() for each row. `role` is the
 * authorization tier — see UserRole.
 */
export type UserProfile = {
  uid: string
  /** Mirrored from Firebase Auth — denormalized so we can render lists
   *  and query by email without going through Admin SDK. Always lowercased. */
  email: string
  displayName: string
  preferredSide: PreferredSide
  role: UserRole
  createdAt: number
  updatedAt: number
}

function userDoc(uid: string) {
  return doc(db, COLLECTION, uid)
}

/**
 * Subscribe to a user's profile doc. Resolves with `null` (and `hydrated:
 * true`) if the doc doesn't exist yet — the caller can then choose to
 * create it on first edit.
 */
export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDoc(uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null)
    },
    onError,
  )
}

type UpsertInput = {
  uid: string
  displayName?: string
  preferredSide?: PreferredSide
}

/**
 * Idempotent upsert. Creates the doc on first call (with sensible defaults
 * for fields the caller didn't pass) and merges otherwise. Always bumps
 * `updatedAt`; only sets `createdAt` on creation.
 */
export async function saveUserProfile({
  uid,
  displayName,
  preferredSide,
}: UpsertInput): Promise<void> {
  const now = Date.now()
  const patch: Record<string, unknown> = {
    uid,
    updatedAt: now,
    // serverTimestamp() runs the merge atomically on the server — useful
    // for ordering/audit even though the typed shape uses client millis.
    _updatedAtServer: serverTimestamp(),
  }
  if (typeof displayName === "string") patch.displayName = displayName.trim()
  if (preferredSide) patch.preferredSide = preferredSide
  // setDoc with merge:true creates the doc if missing and updates fields in
  // place otherwise. We seed `createdAt` only when the doc is new — Firestore
  // ignores the field if we mark it as `serverTimestamp` and the field
  // already exists via the merge contract.
  patch.createdAt = patch.createdAt ?? now
  await setDoc(userDoc(uid), patch, { merge: true })
}

/** Default values for a freshly-rendered settings form (no doc yet). */
export const DEFAULT_USER_PROFILE: Omit<UserProfile, "uid" | "createdAt" | "updatedAt"> = {
  email: "",
  displayName: "",
  preferredSide: "any",
  role: "player",
}

/**
 * Idempotent "make sure this user has a profile doc with sensible role".
 * Called by AuthProvider every time auth state changes — handles three cases:
 *
 *   1. Doc doesn't exist yet → create it. Role is derived from:
 *      - `superadmin` claim → "superadmin"
 *      - `admin` claim → "admin"  (legacy users seeded via set-admin.mjs)
 *      - matching `adminInvites/{email}` exists → "admin" (+ invite is deleted)
 *      - otherwise → "player"
 *   2. Doc exists but lacks `role` (old schema) → backfill role using the
 *      same precedence above.
 *   3. Doc exists with role → only refresh mirrored `email`/`displayName`
 *      if they changed; never downgrade or change the role here.
 *
 * Returns the resulting role so the caller can decide what to do next
 * (e.g. AuthProvider can show toast "te promovieron a admin" on first
 * sign-in after invite acceptance).
 */
export async function ensureUserProfile(args: {
  uid: string
  email: string
  displayName: string
  claims: { admin?: boolean; superadmin?: boolean }
}): Promise<UserRole> {
  const { uid, displayName, claims } = args
  const email = normalizeEmail(args.email)
  const ref = userDoc(uid)
  const snap = await getDoc(ref)
  const now = Date.now()

  if (snap.exists()) {
    const data = snap.data() as Partial<UserProfile>
    if (data.role) {
      // Profile is up-to-date schema. Just refresh mirrored fields if they
      // drifted (e.g. user changed displayName in Google).
      const patch: Record<string, unknown> = {}
      if (data.email !== email) patch.email = email
      if (displayName && data.displayName !== displayName) patch.displayName = displayName
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now
        await updateDoc(ref, patch)
      }
      // Always try to link an unlinked invited-player record — even if the
      // user doc already exists. Covers the case where the organizer added
      // the player invite AFTER the user already had an account.
      await linkInvitedPlayerIfAny(email, uid)
      return data.role
    }
    // Old-schema doc → backfill role.
    const derived = await deriveInitialRole(email, claims)
    await updateDoc(ref, {
      role: derived,
      email,
      // Don't clobber a user-edited displayName; only fill if missing.
      ...(data.displayName ? {} : { displayName }),
      updatedAt: now,
    })
    if (derived === "admin") await consumeAdminInviteIfAny(email)
    await linkInvitedPlayerIfAny(email, uid)
    return derived
  }

  // No doc yet → create it.
  const role = await deriveInitialRole(email, claims)
  const profile: UserProfile = {
    uid,
    email,
    displayName: displayName || email.split("@")[0],
    preferredSide: "any",
    role,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, { ...profile, _createdAtServer: serverTimestamp() })
  if (role === "admin") await consumeAdminInviteIfAny(email)
  await linkInvitedPlayerIfAny(email, uid)
  return role
}

/**
 * Precedence: explicit claims beat invites beat default. We check claims
 * first because they're already-trusted ("admin/superadmin" set by a
 * script means we WANT this user elevated even without an invite).
 */
async function deriveInitialRole(
  email: string,
  claims: { admin?: boolean; superadmin?: boolean },
): Promise<UserRole> {
  if (claims.superadmin) return "superadmin"
  if (claims.admin) return "admin"
  const invite = await findInvite(email)
  return invite ? "admin" : "player"
}

async function consumeAdminInviteIfAny(email: string): Promise<void> {
  const invite = await findInvite(email)
  if (invite) await deleteInvite(invite.email)
}

/**
 * If the organizer invited this email via /jugadores → "Enviar invitación",
 * there's a `players` doc with `invitedEmail == email`. We link the
 * current user to that record so they immediately see their stats /
 * history. Errors are swallowed because:
 *
 *   - The link is a "nice to have" — auth still works if it fails.
 *   - If another tab already linked them, the rule rejects (linkedUid
 *     != null) and that's fine.
 */
async function linkInvitedPlayerIfAny(email: string, uid: string): Promise<void> {
  try {
    const player = await findInvitedPlayer(email)
    if (player && player.linkedUid !== uid) {
      await linkInvitedPlayer(player.id, uid)
    }
  } catch (err) {
    console.error("linkInvitedPlayerIfAny failed (non-fatal):", err)
  }
}

/**
 * Superadmin-only role change. Validated by Firestore rules — calling
 * this as a non-superadmin will reject the write.
 */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(userDoc(uid), {
    role,
    updatedAt: Date.now(),
  })
}

/**
 * Subscribe to all admin-tier users (admin or superadmin). Used by the
 * /admin "Admins actuales" table. Two separate queries because Firestore
 * `in` queries don't compose well with orderBy.
 */
export function subscribeAdmins(
  onData: (admins: UserProfile[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where("role", "in", ["admin", "superadmin"]))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as UserProfile)),
    onError,
  )
}

/**
 * Delete the user's profile doc. Used as part of the account-deletion flow
 * BEFORE we call `deleteUser` on Firebase Auth — that order matters because
 * once the auth user is gone, the security rule `isOwner(uid)` returns
 * false and the client can no longer delete its own doc.
 *
 * Pozos / players / groups owned by this user are NOT cascaded here — that
 * needs a Cloud Function (onAuthDelete) since the client may not have
 * permissions to bulk-delete those docs reliably. Until that exists, those
 * docs become orphaned (owner uid points to a non-existent user) and only
 * an admin can clean them up.
 */
export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(userDoc(uid))
}
