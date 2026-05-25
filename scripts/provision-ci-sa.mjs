#!/usr/bin/env node
/**
 * One-shot provisioner for a dedicated CI service account.
 *
 * - Creates a service account `github-deploy@<project>.iam.gserviceaccount.com`
 * - Grants the project-level roles needed by the deploy workflow:
 *     roles/firebasehosting.admin    (deploy hosting)
 *     roles/firebaserules.admin      (deploy firestore.rules)
 *     roles/datastore.indexAdmin     (deploy firestore indexes)
 *     roles/cloudbuild.builds.viewer (no-op safety net)
 * - Generates a JSON key and prints it to stdout (NOT to a file in repo)
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS pointing to a JSON with enough
 * permissions (Owner or IAM Admin + Project IAM Admin).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/admin.json \
 *     node scripts/provision-ci-sa.mjs > ci-key.json
 *
 * After running:
 *   gh secret set FIREBASE_SERVICE_ACCOUNT < ci-key.json
 *   rm ci-key.json
 */
import { readFileSync } from "node:fs"
import { cert, initializeApp } from "firebase-admin/app"

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credsPath) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS no está seteado.")
  process.exit(1)
}

const adminSa = JSON.parse(readFileSync(credsPath, "utf8"))
const projectId = adminSa.project_id
const credential = cert(adminSa)
initializeApp({ credential, projectId })

async function getToken() {
  const t = await credential.getAccessToken()
  return t.access_token
}

async function api(url, init = {}) {
  const token = await getToken()
  const res = await fetch(url, {
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
    throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${msg}`)
  }
  return body
}

const accountId = "github-deploy"
const saEmail = `${accountId}@${projectId}.iam.gserviceaccount.com`

// 1) Create service account (idempotent — 409 means it already exists)
console.error(`Creating service account ${saEmail}…`)
try {
  await api(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`, {
    method: "POST",
    body: JSON.stringify({
      accountId,
      serviceAccount: {
        displayName: "GitHub Actions deploy",
        description: "Used by .github/workflows for hosting + rules deploys",
      },
    }),
  })
  console.error("  ✓ created")
} catch (err) {
  if (String(err.message).includes("409") || String(err.message).includes("ALREADY_EXISTS")) {
    console.error("  (already exists, continuing)")
  } else {
    throw err
  }
}

// 2) Grant project-level roles. Use addIamPolicyBinding via getIamPolicy/setIamPolicy.
const roles = [
  "roles/firebasehosting.admin",
  "roles/firebaserules.admin",
  "roles/datastore.indexAdmin",
]
const member = `serviceAccount:${saEmail}`

console.error("Fetching project IAM policy…")
const policy = await api(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
  { method: "POST", body: JSON.stringify({}) },
)

const bindings = policy.bindings ?? []
let mutated = false
for (const role of roles) {
  const existing = bindings.find((b) => b.role === role)
  if (existing) {
    if (!existing.members.includes(member)) {
      existing.members.push(member)
      console.error(`  + ${role}`)
      mutated = true
    } else {
      console.error(`  = ${role} (already bound)`)
    }
  } else {
    bindings.push({ role, members: [member] })
    console.error(`  + ${role} (new binding)`)
    mutated = true
  }
}

if (mutated) {
  console.error("Setting updated IAM policy…")
  await api(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`,
    {
      method: "POST",
      body: JSON.stringify({ policy: { ...policy, bindings } }),
    },
  )
  console.error("  ✓ policy updated")
}

// 3) Generate a JSON key
console.error("Generating key…")
const keyRes = await api(
  `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${saEmail}/keys`,
  {
    method: "POST",
    body: JSON.stringify({
      privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
      keyAlgorithm: "KEY_ALG_RSA_2048",
    }),
  },
)
const keyJson = Buffer.from(keyRes.privateKeyData, "base64").toString("utf8")
console.error(`  ✓ key id: ${keyRes.name.split("/").pop()}`)
console.error("")
console.error("Writing service account JSON to stdout (pipe it somewhere safe!).")

process.stdout.write(keyJson)
