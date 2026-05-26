import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore"

import { normalizeEmail } from "@/lib/email"
import { db } from "@/lib/firebase"
import { updatePlayer, type PlayerRecord } from "@/lib/players"

/**
 * Send a player invitation via the Firebase "Trigger Email from Firestore"
 * extension. The extension watches the `mail` collection: any document
 * written there triggers an email send using its configured Mailgun/SendGrid
 * key (set up once in the Firebase console).
 *
 * We also stamp the player record so the UI can show "invited <date>" and
 * avoid duplicate sends.
 */
export async function sendPlayerInvite(input: {
  player: PlayerRecord
  email: string
  ownerName: string
  appUrl: string
}): Promise<void> {
  const { player, email, ownerName, appUrl } = input
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Email inválido")
  }

  const subject = `${ownerName} te invitó a Padel Galaxy`
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">Hola ${escapeHtml(player.name)}!</h2>
      <p style="line-height: 1.5; color: #444;">
        ${escapeHtml(ownerName)} te agregó como jugador en <strong>Padel Galaxy</strong> y quiere
        que veas tus resultados y estadísticas históricas.
      </p>
      <p style="line-height: 1.5; color: #444;">
        Creá tu cuenta usando este mismo email (${escapeHtml(cleanEmail)}) y vas a poder ver
        todos los pozos en los que jugaste, tu evolución a lo largo del tiempo y tu ranking.
      </p>
      <p style="margin: 24px 0;">
        <a href="${appUrl}/login"
           style="display: inline-block; background: #5567c5; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Crear mi cuenta
        </a>
      </p>
      <p style="font-size: 12px; color: #888; margin-top: 32px;">
        Si no esperabas esta invitación podés ignorar este mail.
      </p>
    </div>
  `.trim()

  // The Trigger Email extension expects this document shape.
  // https://firebase.google.com/docs/extensions/official/firestore-send-email
  await addDoc(collection(db, "mail"), {
    to: cleanEmail,
    message: { subject, html },
    // Metadata so we can audit / debug later. The extension ignores extras.
    _meta: {
      kind: "player-invite",
      playerId: player.id,
      ownerId: player.ownerId,
      createdAt: serverTimestamp(),
    },
  })

  await updatePlayer(player.id, {
    invitedEmail: cleanEmail,
    invitedAt: Date.now(),
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Find the player record an organizer invited via `sendPlayerInvite`. Used
 * by the sign-up flow to (a) decide whether to bypass the global signups
 * toggle and (b) link the newly created user to the player record.
 *
 * Returns the FIRST match — if multiple organizers invited the same email
 * we just pick one (rare edge case; could be revisited later by returning
 * a list and letting the user pick).
 */
export async function findInvitedPlayer(email: string): Promise<PlayerRecord | null> {
  const e = normalizeEmail(email)
  if (!e || !e.includes("@")) return null
  const q = query(collection(db, "players"), where("invitedEmail", "==", e))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].data() as PlayerRecord
}

/**
 * Claim an invited-player record for the just-signed-in user. Sets
 * `linkedUid` so future sessions know the link is established, and clears
 * `invitedAt` so the organizer's UI shows the player as "vinculado"
 * instead of "invitado, esperando". `invitedEmail` is kept for audit.
 *
 * This is what consumes the player-invite — there is no separate
 * "playerInvites" collection; the player record IS the invite.
 */
export async function linkInvitedPlayer(playerId: string, uid: string): Promise<void> {
  await updatePlayer(playerId, {
    linkedUid: uid,
    invitedAt: null,
  })
}
