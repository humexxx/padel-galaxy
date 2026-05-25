import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore"

import { db } from "@/lib/firebase"

export type AppSettings = {
  signupsEnabled: boolean
}

const SETTINGS_DOC_ID = "app"

export const DEFAULT_SETTINGS: AppSettings = {
  signupsEnabled: true,
}

function settingsDoc() {
  return doc(db, "settings", SETTINGS_DOC_ID)
}

export function subscribeAppSettings(
  onData: (settings: AppSettings) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    settingsDoc(),
    (snap) => {
      onData(snap.exists() ? { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) } : DEFAULT_SETTINGS)
    },
    onError,
  )
}

export async function getAppSettings(): Promise<AppSettings> {
  const snap = await getDoc(settingsDoc())
  if (!snap.exists()) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) }
}

export async function saveAppSettings(patch: Partial<AppSettings>): Promise<void> {
  await setDoc(settingsDoc(), patch, { merge: true })
}
