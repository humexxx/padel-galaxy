#!/usr/bin/env node
/**
 * Deploy Firestore composite indexes via the Firestore Admin REST API.
 *
 * Reads firestore.indexes.json and creates any index that doesn't already
 * exist on the project (idempotent — comparing by normalized fields).
 * Existing indexes are left alone; this script never deletes anything.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/deploy-indexes.mjs
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

async function api(method, path, body) {
  const token = await getAccessToken()
  const res = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status} ${data.error?.message ?? text}`,
    )
  }
  return data
}

/** Stable, order-sensitive signature for an index's field list. */
function fieldsSignature(fields) {
  return JSON.stringify(
    fields.map((f) => ({
      fieldPath: f.fieldPath,
      order: f.order ?? null,
      arrayConfig: f.arrayConfig ?? null,
    })),
  )
}

const dbPath = `projects/${projectId}/databases/(default)`
const config = JSON.parse(
  readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8"),
)

console.log(`Project: ${projectId}`)
console.log(`Desired indexes: ${config.indexes.length}`)

// Cache existing indexes per collection so we don't re-list each iteration.
const cache = new Map()
async function listExisting(collectionGroup) {
  if (cache.has(collectionGroup)) return cache.get(collectionGroup)
  const res = await api(
    "GET",
    `${dbPath}/collectionGroups/${collectionGroup}/indexes`,
  )
  const list = res.indexes ?? []
  cache.set(collectionGroup, list)
  return list
}

let created = 0
let skipped = 0

for (const idx of config.indexes) {
  const existing = await listExisting(idx.collectionGroup)
  const want = fieldsSignature(idx.fields)
  const match = existing.find((e) => fieldsSignature(e.fields ?? []) === want)

  if (match) {
    const shortName = match.name.split("/").pop()
    const state = match.state ?? "READY"
    console.log(`✓ ${idx.collectionGroup}: already exists (${shortName}, ${state})`)
    skipped++
    continue
  }

  console.log(`+ ${idx.collectionGroup}: creating composite index…`)
  await api(
    "POST",
    `${dbPath}/collectionGroups/${idx.collectionGroup}/indexes`,
    {
      queryScope: idx.queryScope,
      fields: idx.fields,
    },
  )
  console.log(
    `  Created. Firestore is now building it — queries may keep failing for a few minutes.`,
  )
  created++
  // Force a re-list next time in case the user adds more indexes to the same group.
  cache.delete(idx.collectionGroup)
}

console.log(`\n✓ Done. Created ${created}, skipped ${skipped}.`)
