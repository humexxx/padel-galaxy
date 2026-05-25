#!/usr/bin/env node
/**
 * Set the `admin: true` custom claim on a Firebase Auth user.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     node scripts/set-admin.mjs <email-or-uid> [--remove]
 *
 * Examples:
 *   node scripts/set-admin.mjs jahume92@gmail.com
 *   node scripts/set-admin.mjs jahume92@gmail.com --remove
 *
 * The user must already exist in Firebase Auth (i.e. they've logged in once).
 * After setting the claim, the user has to sign out and back in (or call
 * `refreshClaims()` from the client) before the new role is visible.
 */
import { cert, initializeApp, applicationDefault } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { readFileSync, existsSync } from "node:fs"

const args = process.argv.slice(2)
const remove = args.includes("--remove")
const identifier = args.find((a) => !a.startsWith("--"))

if (!identifier) {
  console.error("Usage: node scripts/set-admin.mjs <email-or-uid> [--remove]")
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
  console.error(`No existe el archivo: ${credsPath}`)
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(credsPath, "utf8"))
initializeApp({
  credential: serviceAccount.type === "service_account"
    ? cert(serviceAccount)
    : applicationDefault(),
})

const auth = getAuth()

async function resolveUser(idOrEmail) {
  if (idOrEmail.includes("@")) {
    return auth.getUserByEmail(idOrEmail)
  }
  return auth.getUser(idOrEmail)
}

try {
  const user = await resolveUser(identifier)
  const existingClaims = user.customClaims ?? {}
  const nextClaims = remove
    ? Object.fromEntries(Object.entries(existingClaims).filter(([k]) => k !== "admin"))
    : { ...existingClaims, admin: true }

  await auth.setCustomUserClaims(user.uid, nextClaims)
  console.log(
    `${remove ? "Quité" : "Asigné"} el rol admin a ${user.email ?? user.uid} (uid: ${user.uid}).`,
  )
  console.log(
    "El usuario tiene que cerrar sesión y volver a entrar (o llamar refreshClaims() en el cliente) " +
      "para que el cambio tome efecto.",
  )
} catch (err) {
  console.error("Error:", err.message ?? err)
  process.exit(1)
}
