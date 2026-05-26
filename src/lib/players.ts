import {
  collection,
  deleteDoc,
  doc,
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

type CreatePlayerInput = {
  id: string
  ownerId: string
  name: string
}

export async function createPlayer({
  id,
  ownerId,
  name,
}: CreatePlayerInput): Promise<PlayerRecord> {
  const trimmed = name.trim()
  const now = Date.now()
  const record: PlayerRecord = {
    id,
    ownerId,
    name: trimmed,
    nameLower: normalizeName(trimmed),
    linkedUid: null,
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
