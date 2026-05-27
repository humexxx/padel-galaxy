import {
  arrayUnion,
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
import { normalizeName } from "@/lib/players"

const COLLECTION = "groups"

/**
 * A "group" is a label that organizes pozos together — typically a club,
 * a recurring event, a season, etc. It's owned by the organizer (the user
 * who created it) and pozos reference it via `pozo.groupId`.
 */
export type GroupRecord = {
  id: string
  ownerId: string
  name: string
  /** lowercased, accent-stripped name for case-insensitive search */
  nameLower: string
  /**
   * Denormalized union of all `linkedUids` from pozos belonging to this
   * group. Lets clientes query their groups without owning them — same
   * pattern pozos use to expose participation. Optional for back-compat:
   * groups created before this field shipped won't have it until the
   * next pozo save (or the backfill script) populates it.
   */
  participantUids?: string[]
  createdAt: number
  updatedAt: number
}

function groupDoc(id: string) {
  return doc(db, COLLECTION, id)
}

export function subscribeUserGroups(
  ownerId: string,
  onData: (groups: GroupRecord[]) => void,
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
      onData(snap.docs.map((d) => d.data() as GroupRecord))
    },
    onError,
  )
}

/**
 * Super-admin view: every group in the system regardless of `ownerId`.
 * Firestore rules already allow `isAdmin()` to read any group doc — this
 * function just drops the client-side `where` filter so the snapshot
 * actually delivers them. Callers MUST gate on `isSuperAdmin` before
 * invoking this; a regular user calling it will hit a permission error
 * for the first non-owned doc.
 */
export function subscribeAllGroups(
  onData: (groups: GroupRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("nameLower", "asc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as GroupRecord))
    },
    onError,
  )
}

/**
 * Cliente view: groups the user participates in via at least one pozo.
 * Matches the rule branch `auth.uid in resource.data.participantUids`,
 * which `syncGroupParticipants` populates whenever a pozo with linked
 * players is saved. Doesn't include groups the user owns but never put
 * a pozo into — those still get picked up by `subscribeUserGroups` on
 * the OR-merge side of the caller.
 */
export function subscribeParticipantGroups(
  uid: string,
  onData: (groups: GroupRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // No orderBy here: combining array-contains with orderBy on a
  // different field would require a composite index, and `useGroups`
  // already sorts the merged result client-side anyway. Participant
  // sets are small (a cliente's groups, not a roster), so the lack of
  // server-side sort is irrelevant.
  const q = query(
    collection(db, COLLECTION),
    where("participantUids", "array-contains", uid),
  )
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as GroupRecord))
    },
    onError,
  )
}

/**
 * arrayUnion the given uids onto `/groups/{groupId}.participantUids`.
 * Called from pozo-form right after `savePozo` so a cliente whose uid
 * is in the pozo's `linkedUids` can immediately read the group via the
 * participant rule branch.
 *
 * Idempotent: arrayUnion drops duplicates server-side, so repeat calls
 * with overlapping uid sets are cheap (one write, no growth). Empty
 * uids list short-circuits so we don't burn a write for a pozo with no
 * linked participants.
 */
export async function syncGroupParticipants(
  groupId: string,
  uids: readonly string[],
): Promise<void> {
  if (uids.length === 0) return
  await updateDoc(groupDoc(groupId), {
    participantUids: arrayUnion(...uids),
    updatedAt: Date.now(),
  })
}

type CreateGroupInput = {
  id: string
  ownerId: string
  name: string
}

export async function createGroup({
  id,
  ownerId,
  name,
}: CreateGroupInput): Promise<GroupRecord> {
  const trimmed = name.trim()
  const now = Date.now()
  const record: GroupRecord = {
    id,
    ownerId,
    name: trimmed,
    nameLower: normalizeName(trimmed),
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(groupDoc(id), {
    ...record,
    _createdAtServer: serverTimestamp(),
  })
  return record
}

export async function updateGroup(
  id: string,
  patch: Partial<Omit<GroupRecord, "id" | "ownerId" | "createdAt">>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch, updatedAt: Date.now() }
  if (typeof patch.name === "string") {
    next.nameLower = normalizeName(patch.name)
  }
  await updateDoc(groupDoc(id), next)
}

export async function deleteGroup(id: string): Promise<void> {
  await deleteDoc(groupDoc(id))
}

export function findGroupByName(
  groups: GroupRecord[],
  name: string,
): GroupRecord | undefined {
  const key = normalizeName(name)
  if (!key) return undefined
  return groups.find((g) => g.nameLower === key)
}
