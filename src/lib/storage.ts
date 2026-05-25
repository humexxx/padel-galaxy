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
