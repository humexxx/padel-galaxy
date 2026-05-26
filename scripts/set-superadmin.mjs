#!/usr/bin/env node
/**
 * Set the `superadmin: true` custom claim on a Firebase Auth user.
 *
 * Superadmin is the top tier: can manage other admins, can do anything
 * an admin can, and is the only one allowed into /admin.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     node scripts/set-superadmin.mjs <email-or-uid> [--remove]
 *
 * Examples:
 *   node scripts/set-superadmin.mjs jahume92@gmail.com
 *   node scripts/set-superadmin.mjs jahume92@gmail.com --remove
 *
 * The user must already exist in Firebase Auth. We KEEP any existing
 * `admin: true` claim alongside, so revoking superadmin doesn't quietly
 * downgrade past the admin level — that revoke would need set-admin too.
 *
 * After setting the claim, the user has to sign out and back in (or call
 * `refreshClaims()` from the client) before the new role is visible.
 */
import { cert, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { readFileSync, existsSync } from "node:fs"

const args = process.argv.slice(2)
const remove = args.includes("--remove")
const identifier = args.find((a) => !a.startsWith("--"))

if (!identifier) {
  console.error("Usage: node scripts/set-superadmin.mjs <email-or-uid> [--remove]")
  process.exit(1)
}

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credsPath) {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS no está seteado.\n" +
      "Generá una service account key desde:\n" +
      "  https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk\n" +
      "y exportá la ruta del JSON descargado:\n" +
      "  export GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/serviceAccount.json",
  )
  process.exit(1)
}
if (!existsSync(credsPath)) {
  console.error(`No se encuentra el archivo: ${credsPath}`)
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(credsPath, "utf8"))) })
const auth = getAuth()

// Resolve identifier to a UserRecord — accept email OR uid.
const userRecord = identifier.includes("@")
  ? await auth.getUserByEmail(identifier).catch((err) => {
      console.error(`No se encontró user con email ${identifier}: ${err.message}`)
      process.exit(1)
    })
  : await auth.getUser(identifier).catch((err) => {
      console.error(`No se encontró user con uid ${identifier}: ${err.message}`)
      process.exit(1)
    })

const existing = userRecord.customClaims ?? {}
// Preserve any other claims (incl. `admin`) — only touch `superadmin`.
const next = { ...existing }
if (remove) {
  delete next.superadmin
} else {
  next.superadmin = true
  // A superadmin is implicitly an admin too — keep the legacy `admin`
  // claim populated so rules that only check `admin` keep working.
  next.admin = true
}

await auth.setCustomUserClaims(userRecord.uid, next)
console.log(
  `✓ Claims actualizados para ${userRecord.email ?? userRecord.uid}:`,
  next,
)
console.log("  El usuario debe cerrar sesión y volver a entrar (o llamar a refreshClaims()).")
