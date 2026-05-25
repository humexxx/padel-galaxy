#!/usr/bin/env node
/**
 * Deploy firestore.rules to the project via the Firebase Rules REST API.
 *
 * Authenticates with the service account at GOOGLE_APPLICATION_CREDENTIALS.
 * Bypasses the firebase CLI's serviceusage precheck (which requires extra IAM).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *     node scripts/deploy-rules.mjs
 */
import { readFileSync } from "node:fs"
import { cert, initializeApp } from "firebase-admin/app"

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credsPath) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS no está seteado.")
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(credsPath, "utf8"))
const projectId = serviceAccount.project_id
const credential = cert(serviceAccount)
initializeApp({ credential, projectId })

async function getAccessToken() {
  const t = await credential.getAccessToken()
  return t.access_token
}

async function api(path, init = {}) {
  const token = await getAccessToken()
  const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }
  if (!res.ok) {
    const msg = body.error?.message ?? text
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${msg}`)
  }
  return body
}

const rulesContent = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")

console.log(`Project: ${projectId}`)
console.log(`Reading firestore.rules (${rulesContent.length} bytes)…`)

// 1) Create ruleset
const ruleset = await api(`projects/${projectId}/rulesets`, {
  method: "POST",
  body: JSON.stringify({
    source: { files: [{ name: "firestore.rules", content: rulesContent }] },
  }),
})
console.log(`Created ruleset: ${ruleset.name}`)

// 2) Upsert the release. Patch first; create on 404.
const releaseShort = "cloud.firestore"
const releaseName = `projects/${projectId}/releases/${releaseShort}`
try {
  await api(releaseName, {
    method: "PATCH",
    body: JSON.stringify({
      release: { name: releaseName, rulesetName: ruleset.name },
    }),
  })
  console.log(`Updated existing release ${releaseShort}.`)
} catch (err) {
  if (String(err.message).includes("404")) {
    await api(`projects/${projectId}/releases`, {
      method: "POST",
      body: JSON.stringify({ name: releaseName, rulesetName: ruleset.name }),
    })
    console.log(`Created release ${releaseShort}.`)
  } else {
    throw err
  }
}

console.log("\n✓ firestore.rules deployed.")
