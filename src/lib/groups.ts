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
