import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { Pozo } from "@/lib/pozo/types"

const COLLECTION = "pozos"

function pozoDoc(id: string) {
  return doc(db, COLLECTION, id)
}

export function subscribeUserPozos(
  ownerId: string,
  onData: (pozos: Pozo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where("ownerId", "==", ownerId),
    orderBy("createdAt", "desc"),
  )
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as Pozo))
    },
    onError,
  )
}

/**
 * Pozos where the user is a participant (their uid is in the denormalized
 * `linkedUids` array). Only matches pozos created after the field was
 * added — older docs need to be re-saved by the owner to populate it.
 */
export function subscribeParticipantPozos(
  uid: string,
  onData: (pozos: Pozo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where("linkedUids", "array-contains", uid),
    orderBy("createdAt", "desc"),
  )
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as Pozo))
    },
    onError,
  )
}

/**
 * Super-admin view: every pozo in the system. Firestore rules
 * (`/pozos` allow read if isOwner || isAdmin) already authorize this —
 * we just drop the client-side ownerId filter. Callers MUST gate on
 * `isSuperAdmin` before invoking; a regular user will hit a permission
 * error on the first non-owned doc.
 */
export function subscribeAllPozos(
  onData: (pozos: Pozo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as Pozo))
    },
    onError,
  )
}

export function subscribePozo(
  id: string,
  onData: (pozo: Pozo | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    pozoDoc(id),
    (snap) => {
      onData(snap.exists() ? (snap.data() as Pozo) : null)
    },
    onError,
  )
}

export async function savePozo(pozo: Pozo): Promise<void> {
  await setDoc(pozoDoc(pozo.id), pozo)
}

export async function patchPozo(id: string, patch: Partial<Pozo>): Promise<void> {
  await updateDoc(pozoDoc(id), patch)
}

export async function removePozo(id: string): Promise<void> {
  await deleteDoc(pozoDoc(id))
}
