#!/usr/bin/env node
/**
 * One-shot migration: for every owner who has pozos without a `groupId`,
 * create a group called "Test" (or reuse one if it already exists) and link
 * those orphan pozos to it.
 *
 * Idempotent: re-running is safe — it skips owners whose pozos all have a
 * groupId already.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     node scripts/migrate-orphan-pozos.mjs
 */
import { readFileSync } from "node:fs"
import { cert, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credsPath) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS no está seteado.")
  process.exit(1)
}

const sa = JSON.parse(readFileSync(credsPath, "utf8"))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const GROUP_NAME = "Test"
const GROUP_NAME_LOWER = GROUP_NAME.toLowerCase()

async function ensureTestGroup(ownerId) {
  // Look for an existing "Test" group for this owner first (idempotent).
  const existing = await db
    .collection("groups")
    .where("ownerId", "==", ownerId)
    .where("nameLower", "==", GROUP_NAME_LOWER)
    .limit(1)
    .get()
  if (!existing.empty) {
    const doc = existing.docs[0]
    return { id: doc.id, created: false }
  }
  const ref = db.collection("groups").doc()
  const now = Date.now()
  await ref.set({
    id: ref.id,
    ownerId,
    name: GROUP_NAME,
    nameLower: GROUP_NAME_LOWER,
    createdAt: now,
    updatedAt: now,
  })
  return { id: ref.id, created: true }
}

async function main() {
  console.log(`Project: ${sa.project_id}`)

  const orphans = await db
    .collection("pozos")
    .get()
    .then((snap) =>
      snap.docs.filter((d) => {
        const data = d.data()
        return !data.groupId || typeof data.groupId !== "string"
      }),
    )

  if (orphans.length === 0) {
    console.log("✓ No hay pozos sin groupId. Nada que migrar.")
    return
  }

  // Bucket orphans by owner.
  const byOwner = new Map()
  for (const d of orphans) {
    const ownerId = d.data().ownerId
    if (!ownerId) {
      console.warn(`  Pozo ${d.id} sin ownerId — saltado.`)
      continue
    }
    const list = byOwner.get(ownerId) ?? []
    list.push(d)
    byOwner.set(ownerId, list)
  }

  console.log(
    `Encontrados ${orphans.length} pozos huérfanos de ${byOwner.size} owners.`,
  )

  let totalLinked = 0
  for (const [ownerId, docs] of byOwner) {
    const { id: groupId, created } = await ensureTestGroup(ownerId)
    console.log(
      `  ${ownerId.slice(0, 8)}… → grupo Test ${created ? "(creado)" : "(reusado)"} ${groupId}`,
    )
    // Batched write for efficiency.
    const batch = db.batch()
    for (const d of docs) {
      batch.update(d.ref, { groupId })
    }
    await batch.commit()
    totalLinked += docs.length
    console.log(`    Linkeados ${docs.length} pozos al grupo`)
  }

  console.log(`\n✓ Done. Linkeados ${totalLinked} pozos huérfanos.`)
}

await main().catch((err) => {
  console.error("Error:", err.message ?? err)
  process.exit(1)
})
