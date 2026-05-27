#!/usr/bin/env node
/**
 * One-shot backfill: union each pozo's `linkedUids` into the matching
 * /groups doc's `participantUids`. Required when shipping the
 * participant-read rule on /groups so existing groups that pre-date the
 * `syncGroupParticipants` write-side sync become readable to their
 * historical participants.
 *
 * Idempotent (arrayUnion). Safe to run any number of times.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *     node scripts/backfill-group-participants.mjs
 */
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

initializeApp({
  credential: applicationDefault(),
  projectId: "padel-galaxy-1c7a2",
})
const db = getFirestore()

const pozos = await db.collection("pozos").get()
console.log(`Scanning ${pozos.size} pozos…`)

// Group by groupId, union the linkedUids.
const byGroup = new Map() // groupId -> Set<uid>
for (const doc of pozos.docs) {
  const d = doc.data()
  if (!d.groupId) continue
  const linked = Array.isArray(d.linkedUids) ? d.linkedUids : []
  if (linked.length === 0) continue
  const set = byGroup.get(d.groupId) ?? new Set()
  for (const u of linked) if (typeof u === "string" && u.length > 0) set.add(u)
  byGroup.set(d.groupId, set)
}

if (byGroup.size === 0) {
  console.log("Nothing to backfill — no pozos have linkedUids.")
  process.exit(0)
}

console.log(`Updating ${byGroup.size} groups…`)
for (const [groupId, uids] of byGroup) {
  const list = [...uids]
  console.log(`  groups/${groupId} ← arrayUnion(${list.length} uids)`)
  await db.collection("groups").doc(groupId).update({
    participantUids: FieldValue.arrayUnion(...list),
    updatedAt: Date.now(),
  })
}

console.log("Done.")
