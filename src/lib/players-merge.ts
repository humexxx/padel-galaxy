import { collection, doc, getDocs, writeBatch } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { PlayerRecord } from "@/lib/players"
import type { Pozo } from "@/lib/pozo/types"

/**
 * Merging two roster records that are really the same person (e.g. the
 * organizer typed "Juan" in one pozo and "Juan P" in another). The
 * `source` record's pozo references get re-pointed at `target`, identity
 * fields the target lacks (linkedUid, invitedEmail) are carried over, and
 * the source doc is deleted.
 */

/** True when these two records can't be merged: both are claimed by
 * DIFFERENT user accounts, so neither side can absorb the other. */
export function isMergeBlocked(a: PlayerRecord, b: PlayerRecord): boolean {
  return Boolean(a.linkedUid && b.linkedUid && a.linkedUid !== b.linkedUid)
}

/**
 * Pure transform: re-point every reference to `source` inside one pozo doc
 * to `target`. Returns null when the pozo doesn't reference the source
 * (caller skips the write).
 *
 * If both records somehow appear in the SAME pozo, the roster entry is
 * deduped; match pairings keep both slots pointing at the target — the
 * standings simply attribute all of those games to the merged player.
 */
export function mergePlayerInPozo(
  pozo: Pozo,
  source: PlayerRecord,
  target: PlayerRecord,
): Pozo | null {
  if (!pozo.players.some((p) => p.id === source.id)) return null

  const seen = new Set<string>()
  const players = pozo.players
    .map((p) => (p.id === source.id ? { id: target.id, name: target.name } : p))
    .filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

  const swap = (id: string) => (id === source.id ? target.id : id)
  const matches = pozo.matches.map((m) => ({
    ...m,
    teamA: { playerA: swap(m.teamA.playerA), playerB: swap(m.teamA.playerB) },
    teamB: { playerA: swap(m.teamB.playerA), playerB: swap(m.teamB.playerB) },
  }))

  // The merged record carries target's uid when it has one, else source's.
  // Rewrite the denormalized participant list to match so the linked user
  // keeps (or gains) read access to this pozo.
  const mergedUid = target.linkedUid ?? source.linkedUid
  const uids = new Set(pozo.linkedUids ?? [])
  if (source.linkedUid && source.linkedUid !== mergedUid) {
    uids.delete(source.linkedUid)
  }
  if (mergedUid) uids.add(mergedUid)

  return { ...pozo, players, matches, linkedUids: [...uids] }
}

/**
 * Re-point every pozo from `source` to `target`, enrich the target record
 * with whatever identity fields it's missing, and delete the source — all
 * in one atomic batch.
 *
 * Admin-only surface: reading EVERY pozo (there's no Firestore index into
 * the nested `players[].id` array, so we scan and filter client-side) and
 * writing pozos owned by other organizers both require admin-tier rules.
 */
export async function mergePlayers(
  source: PlayerRecord,
  target: PlayerRecord,
): Promise<{ pozosUpdated: number }> {
  if (source.id === target.id) {
    throw new Error("No podés fusionar un jugador consigo mismo.")
  }
  if (isMergeBlocked(source, target)) {
    throw new Error(
      "Los dos registros están vinculados a cuentas distintas — no se pueden fusionar.",
    )
  }

  const snap = await getDocs(collection(db, "pozos"))
  const affected: Pozo[] = []
  snap.forEach((d) => {
    const merged = mergePlayerInPozo(d.data() as Pozo, source, target)
    if (merged) affected.push(merged)
  })

  const batch = writeBatch(db)
  for (const pozo of affected) {
    batch.set(doc(db, "pozos", pozo.id), pozo)
  }
  const patch: Record<string, unknown> = { updatedAt: Date.now() }
  if (!target.linkedUid && source.linkedUid) patch.linkedUid = source.linkedUid
  if (!target.invitedEmail && source.invitedEmail) {
    patch.invitedEmail = source.invitedEmail
  }
  if (!target.invitedAt && source.invitedAt) patch.invitedAt = source.invitedAt
  batch.update(doc(db, "players", target.id), patch)
  batch.delete(doc(db, "players", source.id))
  await batch.commit()

  return { pozosUpdated: affected.length }
}
