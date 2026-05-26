import { initializeApp, getApps } from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"

// In test mode (vitest) the Firebase env vars aren't present in CI, and
// the auth SDK throws `auth/invalid-api-key` if apiKey is empty. Tests
// that hit Firebase mock it directly, so a placeholder is enough to let
// initializeApp/getAuth complete without aborting the suite.
const isTest = import.meta.env.MODE === "test"
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ??
    (isTest ? "test-api-key" : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ??
    (isTest ? "test-project" : undefined),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ??
    (isTest ? "1:0:web:test" : undefined),
}

const app = getApps()[0] ?? initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "1" && typeof window !== "undefined") {
  // Idempotent on HMR: connecting twice throws, so guard on a window flag.
  const w = window as unknown as { __pgEmulatorsWired?: boolean }
  if (!w.__pgEmulatorsWired) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
    connectFirestoreEmulator(db, "127.0.0.1", 8080)
    w.__pgEmulatorsWired = true
  }
}
