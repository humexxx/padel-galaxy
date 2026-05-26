import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore"

import { normalizeEmail } from "@/lib/email"
import { db } from "@/lib/firebase"

const COLLECTION = "adminInvites"

/**
 * An "admin invite" is a pending promise: when a user with this email
 * signs up (or signs in for the first time), they get role=admin and the
 * invite is consumed (deleted) by AuthProvider.ensureUserProfile.
 *
 * Doc id = normalized email — keeps lookups O(1) and prevents duplicate
 * invites for the same address by construction.
 */
export type AdminInvite = {
  /** Normalized (lowercased) email. Also serves as the doc id. */
  email: string
  /** Display version of the email the superadmin typed — preserved for the
   *  invite mail body (some users want capitalized first letters). */
  emailDisplay: string
  invitedAt: number
  invitedBy: string
}

function inviteDoc(emailId: string) {
  return doc(db, COLLECTION, emailId)
}

/**
 * Create an invite + enqueue the email through the Trigger Email
 * extension (writes to /mail). Both writes happen sequentially — if the
 * mail write fails, the invite stays (better stale invite than nothing).
 *
 * Idempotent on the invite side: re-inviting the same email overwrites
 * the existing doc (refreshing invitedAt). The mail still gets enqueued
 * so the invitee gets a reminder.
 */
export async function createInvite(args: {
  email: string
  invitedBy: string
  appUrl?: string
}): Promise<AdminInvite> {
  const emailDisplay = args.email.trim()
  const email = normalizeEmail(emailDisplay)
  const now = Date.now()
  const invite: AdminInvite = {
    email,
    emailDisplay,
    invitedAt: now,
    invitedBy: args.invitedBy,
  }
  await setDoc(inviteDoc(email), {
    ...invite,
    _invitedAtServer: serverTimestamp(),
  })

  // Best-effort enqueue. The Trigger Email extension reads /mail and
  // sends; if it's misconfigured this throws but we don't unroll the
  // invite — the superadmin can re-invite later.
  const appUrl = args.appUrl ?? window.location.origin
  try {
    await setDoc(doc(collection(db, "mail")), {
      to: [emailDisplay],
      message: {
        subject: "Te invitaron a Padel Galaxy como admin",
        text:
          `Hola,\n\n` +
          `Te invitaron a Padel Galaxy con permisos de administrador.\n\n` +
          `Entrá a ${appUrl} y registrate / ingresá con este mismo email ` +
          `(${emailDisplay}). Cuando inicies sesión vas a tener acceso ` +
          `automáticamente al panel de admin.\n\n` +
          `Si no esperabas esta invitación, ignorá este mensaje.\n`,
        html:
          `<p>Hola,</p>` +
          `<p>Te invitaron a <strong>Padel Galaxy</strong> con permisos de administrador.</p>` +
          `<p>Entrá a <a href="${appUrl}">${appUrl}</a> y registrate / ingresá con este mismo email ` +
          `(<code>${emailDisplay}</code>). Cuando inicies sesión vas a tener acceso ` +
          `automáticamente al panel de admin.</p>` +
          `<p style="color:#666;font-size:12px">Si no esperabas esta invitación, ignorá este mensaje.</p>`,
      },
    })
  } catch (err) {
    console.error("No se pudo enqueue el mail de invitación:", err)
    // Re-throw so the UI can show a partial-success message.
    throw new Error("invite-created-but-mail-failed")
  }

  return invite
}

export async function deleteInvite(emailOrId: string): Promise<void> {
  await deleteDoc(inviteDoc(normalizeEmail(emailOrId)))
}

/**
 * One-shot lookup by email. Returns null if no pending invite.
 * Called by AuthProvider on every sign-in to check for promotion.
 */
export async function findInvite(email: string): Promise<AdminInvite | null> {
  const snap = await getDoc(inviteDoc(normalizeEmail(email)))
  return snap.exists() ? (snap.data() as AdminInvite) : null
}

/**
 * Stream all pending invites for the /admin page. Ordered oldest-first
 * because that matches the natural reading order of "still waiting on…".
 */
export function subscribeInvites(
  onData: (invites: AdminInvite[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("invitedAt", "asc"))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as AdminInvite)),
    onError,
  )
}
