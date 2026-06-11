import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
import {
  createPlayer,
  findPlayerByLinkedUid,
  updatePlayer,
} from "@/lib/players"

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
  // Propagate name changes to the linked /players doc so future pozos
  // pick up the new name. Past pozos keep their snapshot — see the
  // doc comment on `syncLinkedPlayerName`.
  if (typeof displayName === "string") {
    await syncLinkedPlayerName(uid, displayName)
  }
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
  emailVerified: boolean
  claims: { admin?: boolean; superadmin?: boolean }
}): Promise<UserRole> {
  const { uid, displayName, emailVerified, claims } = args
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
        // Mirror the displayName change onto the linked /players doc.
        // Only runs when patch.displayName was actually set above (i.e.
        // the value really changed), so we don't write unnecessarily.
        if (patch.displayName) {
          await syncLinkedPlayerName(uid, displayName)
        }
      }
      // Always try to link an unlinked invited-player record — even if the
      // user doc already exists. Covers the case where the organizer added
      // the player invite AFTER the user already had an account.
      await linkInvitedPlayerIfAny(email, uid, emailVerified)
      // Make sure clientes have a self-owned /players doc so the header
      // can show "Jugador" → their profile. Idempotent (no-op if the
      // invite-link path above already attached a doc).
      await ensureSelfPlayer({
        uid,
        displayName: displayName || email.split("@")[0],
        email,
        role: data.role,
      })
      // NOTE: we don't auto-promote a player-role user even if an admin
      // invite is pending for their email — the /users update rule rejects
      // a self-update that changes role. The superadmin promotes them
      // directly from /admin (InviteAdminCard detects the existing user).
      return data.role
    }
    // Old-schema doc → backfill role.
    const derived = await deriveInitialRole(email, emailVerified, claims)
    await updateDoc(ref, {
      role: derived,
      email,
      // Don't clobber a user-edited displayName; only fill if missing.
      ...(data.displayName ? {} : { displayName }),
      updatedAt: now,
    })
    if (derived === "admin") await consumeAdminInviteIfAny(email)
    await linkInvitedPlayerIfAny(email, uid, emailVerified)
    await ensureSelfPlayer({
      uid,
      displayName: displayName || email.split("@")[0],
      email,
      role: derived,
    })
    return derived
  }

  // No doc yet → create it.
  const role = await deriveInitialRole(email, emailVerified, claims)
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
  await linkInvitedPlayerIfAny(email, uid, emailVerified)
  await ensureSelfPlayer({
    uid,
    displayName: displayName || email.split("@")[0],
    email,
    role,
  })
  return role
}

/**
 * Precedence: explicit claims beat invites beat default. We check claims
 * first because they're already-trusted ("admin/superadmin" set by a
 * script means we WANT this user elevated even without an invite).
 *
 * IMPORTANT: returning 'admin' from this function will be rejected by the
 * firestore rule unless `email_verified` is true OR the caller has a
 * privileged claim already. So when there's a pending invite but the
 * user's email isn't verified yet, we fall back to 'player' — the invite
 * stays for the superadmin to consume manually via /admin once the user
 * has verified their email + signed in at least once.
 */
async function deriveInitialRole(
  email: string,
  emailVerified: boolean,
  claims: { admin?: boolean; superadmin?: boolean },
): Promise<UserRole> {
  if (claims.superadmin) return "superadmin"
  if (claims.admin) return "admin"
  if (!emailVerified) return "player"
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
async function linkInvitedPlayerIfAny(
  email: string,
  uid: string,
  emailVerified: boolean,
): Promise<void> {
  // The /players read rule's invite-email branch requires
  // `hasVerifiedEmail()`, so an unverified user querying
  // `where invitedEmail == ...` always hits a PERMISSION_DENIED.
  // Skip the query entirely in that case — there's no way to satisfy
  // the rule until the user verifies their email, so any pending
  // invite stays parked for the next signin after verification.
  if (!emailVerified) return
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
 * Ensure a cliente has a `/players` doc linked to their account. Runs
 * after `linkInvitedPlayerIfAny` — if there was a pending invite, that
 * path already linked an existing record, so this becomes a no-op.
 * Otherwise we auto-create a fresh self-owned doc so the header can
 * surface "Jugador" → /jugadores/:id from day 1, before any organizer
 * touches the roster.
 *
 * Skipped for admins/superadmins by convention: they OWN player rosters
 * but aren't typically IN them. If an admin wants a player profile they
 * can create one manually (or get added to someone else's pozo).
 *
 * The `/players` create rule allows `ownerId == request.auth.uid` with
 * a non-empty name; we satisfy both with the user's own uid and their
 * displayName. The `linkedUid` field isn't validated by the rule, so
 * pre-setting it at create time is fine — the only invariant is that
 * subsequent updates can't change ownerId, which we don't.
 *
 * Errors are swallowed: the user is signed in either way, and the next
 * auth state change will retry idempotently. We log so an organizer
 * watching the console notices recurring failures.
 */
/**
 * Propagate a displayName change to the user's linked `/players` doc so
 * future pozo rosters render the new name. Past pozos keep their
 * historical `players[].name` snapshot intact — those are denormalized
 * at the time of the pozo, not foreign keys, which is the correct
 * behavior for archived sport results (you don't rewrite history when
 * someone changes their handle).
 *
 * Called from two places:
 *   - `saveUserProfile` when the user edits their name in /settings
 *   - `ensureUserProfile` when we detect drift from the Google profile
 *
 * The cliente is `ownerId` of their auto-created /players doc, so the
 * Firestore update rule passes (owner branch + name length check).
 * Idempotent: no-op if name didn't actually change, and silently
 * skipped if the user has no linked record (admin, or invite not yet
 * sent + accepted).
 */
async function syncLinkedPlayerName(uid: string, newName: string): Promise<void> {
  try {
    const trimmed = newName.trim()
    if (!trimmed) return
    const player = await findPlayerByLinkedUid(uid)
    if (!player) return
    if (player.name === trimmed) return
    await updatePlayer(player.id, { name: trimmed })
  } catch (err) {
    console.error("syncLinkedPlayerName failed (non-fatal):", err)
  }
}

async function ensureSelfPlayer(args: {
  uid: string
  displayName: string
  email: string
  role: UserRole
}): Promise<void> {
  if (args.role !== "player") return
  try {
    const existing = await findPlayerByLinkedUid(args.uid)
    if (existing) {
      // Backfill `invitedEmail` if the auto-create from an older session
      // left it null. We can tell this is a self-signup record (not an
      // invite) because `invitedAt` is null — invite-flow records have
      // an `invitedAt` set, and rewriting their email would clobber the
      // organizer's original target.
      if (
        existing.invitedAt === null &&
        existing.invitedEmail !== args.email
      ) {
        await updatePlayer(existing.id, { invitedEmail: args.email })
      }
      return
    }
    // Use Firestore-generated ids for consistency with the rest of the
    // /players surface (pozo-form does the same: `doc(collection).id`).
    const id = doc(collection(db, "players")).id
    const name =
      args.displayName.trim() ||
      args.email.split("@")[0] ||
      "Jugador"
    await createPlayer({
      id,
      ownerId: args.uid,
      name,
      linkedUid: args.uid,
      invitedEmail: args.email,
    })
  } catch (err) {
    console.error("ensureSelfPlayer failed (non-fatal):", err)
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
 * Subscribe to all player-tier users ("clientes"). Used by the /admin
 * "Clientes registrados" table so the superadmin can promote them without
 * retyping their email. Same rule footprint as `subscribeAdmins`: only
 * admin-tier callers can read other users' docs.
 */
export function subscribeClienteUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where("role", "==", "player"))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as UserProfile)),
    onError,
  )
}

/**
 * One-shot lookup by email. Used by the admin panel to detect whether an
 * email already has a registered account before falling back to the email
 * invite flow. Returns null when no user matches.
 *
 * The rule `/users` allows isAdmin() to read any doc — the where-query
 * works as long as the caller is admin tier. Don't call this from anywhere
 * else without re-checking permissions.
 */
export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const e = normalizeEmail(email)
  if (!e) return null
  const q = query(collection(db, COLLECTION), where("email", "==", e))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].data() as UserProfile
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
