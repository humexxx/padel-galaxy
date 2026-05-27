import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

const COLLECTION = "players"

/**
 * A player document is owned by the user who created the roster (the
 * organizer / admin of pozos). When the player accepts an invite and
 * creates their own account, `linkedUid` gets populated and the player
 * can read aggregated stats across all pozos that referenced them.
 */
export type PlayerRecord = {
  id: string
  ownerId: string
  name: string
  /** lowercased, accent-stripped name for case-insensitive search */
  nameLower: string
  /** Firebase Auth uid once the player has accepted an invite. */
  linkedUid: string | null
  /** Email captured when sending an invite. Indexed for invite lookup. */
  invitedEmail: string | null
  /** Millis since epoch when the invite was sent (null = no invite). */
  invitedAt: number | null
  createdAt: number
  updatedAt: number
}

function playerDoc(id: string) {
  return doc(db, COLLECTION, id)
}

/** Strip diacritics + lowercase. Stable key for fuzzy matching by name. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

export function subscribeUserPlayers(
  ownerId: string,
  onData: (players: PlayerRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where("ownerId", "==", ownerId),
    orderBy("nameLower", "asc"),
  )
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as PlayerRecord))
    },
    onError,
  )
}

/**
 * Subscribe to the player record linked to a given user uid. Used by the
 * site header to render "Mi perfil" for cliente-tier users instead of the
 * organizer's full /jugadores roster. Returns `null` if no /players doc has
 * `linkedUid == uid` — that's expected for admins (who own the roster but
 * aren't linked to a player record) and for clientes who haven't been
 * invited yet.
 *
 * The /players rule allows the linked user to read their own record, so
 * the `where("linkedUid", "==", uid)` query is rule-safe for any caller.
 */
/**
 * One-shot lookup: does a /players doc with `linkedUid == uid` already
 * exist? Mirrors `subscribeMyPlayer` but uses `getDocs` so callers (e.g.
 * the signup-time auto-create check in `ensureSelfPlayer`) can await a
 * single answer instead of subscribing.
 *
 * Returns the first matching record (there should only ever be one —
 * the auto-create + invite-link paths both check before writing) or
 * null if none.
 */
export async function findPlayerByLinkedUid(
  uid: string,
): Promise<PlayerRecord | null> {
  const q = query(collection(db, COLLECTION), where("linkedUid", "==", uid))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].data() as PlayerRecord
}

export function subscribeMyPlayer(
  uid: string,
  onData: (player: PlayerRecord | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where("linkedUid", "==", uid))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.empty ? null : (snap.docs[0].data() as PlayerRecord))
    },
    onError,
  )
}

/**
 * Super-admin view: every player in the system. Firestore rules allow
 * `isAdmin` reads on any /players doc, so the broader query is safe.
 * Callers MUST gate on `isSuperAdmin` — a regular user will hit a
 * permission error on the first record they don't own AND haven't been
 * invited to.
 */
export function subscribeAllPlayers(
  onData: (players: PlayerRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("nameLower", "asc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as PlayerRecord))
    },
    onError,
  )
}

type CreatePlayerInput = {
  id: string
  ownerId: string
  name: string
  /**
   * Pre-link this record to a user account at creation time. Used by the
   * cliente self-signup path where the new user owns AND is the linked
   * user of their own player record — they need a profile to land on
   * from day 1, before any organizer invite reaches them.
   *
   * Organizers creating a roster slot (the common case) leave this off
   * so the record stays unlinked until the invitee claims it.
   */
  linkedUid?: string
}

export async function createPlayer({
  id,
  ownerId,
  name,
  linkedUid,
}: CreatePlayerInput): Promise<PlayerRecord> {
  const trimmed = name.trim()
  const now = Date.now()
  const record: PlayerRecord = {
    id,
    ownerId,
    name: trimmed,
    nameLower: normalizeName(trimmed),
    linkedUid: linkedUid ?? null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(playerDoc(id), {
    ...record,
    // serverTimestamp() is ignored when reading back into the typed shape,
    // but it gives Firestore a real server-side createdAt for ordering /
    // security rules if we ever want to switch from client-millis.
    _createdAtServer: serverTimestamp(),
  })
  return record
}

export async function updatePlayer(
  id: string,
  patch: Partial<Omit<PlayerRecord, "id" | "ownerId" | "createdAt">>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch, updatedAt: Date.now() }
  if (typeof patch.name === "string") {
    next.nameLower = normalizeName(patch.name)
  }
  await updateDoc(playerDoc(id), next)
}

export async function deletePlayer(id: string): Promise<void> {
  await deleteDoc(playerDoc(id))
}

/**
 * Find a player by normalized name in the owner's roster. Used to
 * deduplicate before creating a new player when the user types a name
 * that already exists.
 */
export function findPlayerByName(
  players: PlayerRecord[],
  name: string,
): PlayerRecord | undefined {
  const key = normalizeName(name)
  if (!key) return undefined
  return players.find((p) => p.nameLower === key)
}
