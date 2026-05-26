#!/usr/bin/env node
/**
 * List every user in Firebase Auth — used to confirm the "single account"
 * assumption before locking /admin to superadmin-only.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     node scripts/list-users.mjs
 */
import { cert, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { readFileSync, existsSync } from "node:fs"

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credsPath) {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS no está seteado.\n" +
      "Ejemplo: GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/sa.json node scripts/list-users.mjs",
  )
  process.exit(1)
}
if (!existsSync(credsPath)) {
  console.error(`No se encuentra el archivo: ${credsPath}`)
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(credsPath, "utf8"))) })
const auth = getAuth()

const all = []
let pageToken
do {
  // Auth listUsers paginates up to 1000 per call — fine for our scale.
  const page = await auth.listUsers(1000, pageToken)
  all.push(...page.users)
  pageToken = page.pageToken
} while (pageToken)

console.log(`\n${all.length} cuenta(s) de Firebase Auth:\n`)
for (const u of all) {
  const claims = u.customClaims ?? {}
  const flags = [
    claims.superadmin ? "SUPERADMIN" : null,
    claims.admin ? "admin" : null,
    u.disabled ? "disabled" : null,
  ]
    .filter(Boolean)
    .join(", ")
  const providers = u.providerData.map((p) => p.providerId).join(", ") || "—"
  console.log(
    `  ${u.email ?? "(sin email)"}  ·  uid=${u.uid}  ·  providers=${providers}` +
      (flags ? `  ·  [${flags}]` : ""),
  )
}
console.log("")
