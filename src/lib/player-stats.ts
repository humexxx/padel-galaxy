import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore"

import { db } from "@/lib/firebase"
import { computeStandings, sortStandings, type StandingsSort } from "@/lib/pozo/standings"
import type { Pozo } from "@/lib/pozo/types"

/** A single data point in a player's history — one finished pozo. */
export type PlayerPozoStat = {
  pozoId: string
  pozoName: string
  /** Group this pozo belongs to, or null if it was created before groups. */
  groupId: string | null
  /** Millis since epoch — finishedAt if available, else createdAt. */
  date: number
  /** Games this player accumulated in the pozo (sum across all their matches). */
  gamesWon: number
  /** Matches the player's team won. */
  matchesWon: number
  /** matchesPlayed - matchesWon - matchesTied (real losses, not ties). */
  matchesLost: number
  /** Tournament-style: 3 * win + 1 * tie. */
  points: number
  /**
   * Final position (1-based). Computed by sorting standings with the
   * caller-chosen metric — when the user toggles the chart metric, we
   * re-derive position for that metric.
   */
  finalPosition: number
}

const COLLECTION = "pozos"

/**
 * Subscribe to all FINISHED pozos that include `playerId` in their players[].
 *
 * Firestore can't filter "players array contains object with id == X" without
 * a denormalized field, so we fetch the caller's accessible pozos and filter
 * in-memory. "Accessible" is the UNION of:
 *
 *   1. Pozos the caller owns (`ownerId == callerUid`) — the organizer/admin
 *      path. Sees every pozo they created, including ones the target
 *      `playerId` was added to.
 *   2. Pozos where the caller is a linked participant
 *      (`linkedUids array-contains callerUid`) — the cliente self-view path.
 *      Without this, a cliente looking at their own profile would see nothing
 *      because they never own pozos.
 *
 * Both subscriptions are kept open so the chart updates live. Errors on
 * either query are logged but don't block the other — if e.g. the
 * participant query hits a rules edge case, the owner query still streams
 * its results. The dedupe-by-id step in `flush()` handles the overlap
 * (the caller is both owner AND participant for a pozo they organized
 * and also played in).
 */
export function subscribePlayerHistory(
  callerUid: string,
  playerId: string,
  sort: StandingsSort,
  onData: (stats: PlayerPozoStat[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  let owned: Pozo[] = []
  let participant: Pozo[] = []
  let ownedReady = false
  let participantReady = false

  function flush() {
    if (!ownedReady || !participantReady) return
    const byId = new Map<string, Pozo>()
    for (const p of owned) byId.set(p.id, p)
    for (const p of participant) if (!byId.has(p.id)) byId.set(p.id, p)

    const stats: PlayerPozoStat[] = []
    for (const pozo of byId.values()) {
      if (pozo.status !== "finished") continue
      if (!pozo.players.some((p) => p.id === playerId)) continue
      stats.push(computeStat(pozo, playerId, sort))
    }
    // Chronological order so the chart renders left-to-right correctly.
    stats.sort((a, b) => a.date - b.date)
    onData(stats)
  }

  const ownedQ = query(
    collection(db, COLLECTION),
    where("ownerId", "==", callerUid),
  )
  const unsubOwned = onSnapshot(
    ownedQ,
    (snap) => {
      owned = snap.docs.map((d) => d.data() as Pozo)
      ownedReady = true
      flush()
    },
    (err) => {
      console.error("subscribePlayerHistory.owned error:", err)
      onError?.(err)
      ownedReady = true
      flush()
    },
  )

  const participantQ = query(
    collection(db, COLLECTION),
    where("linkedUids", "array-contains", callerUid),
  )
  const unsubParticipant = onSnapshot(
    participantQ,
    (snap) => {
      participant = snap.docs.map((d) => d.data() as Pozo)
      participantReady = true
      flush()
    },
    (err) => {
      // Don't propagate up — the participant query can fail under the
      // current rules' static analyzer (Property ownerId is undefined...);
      // we still want to render whatever the owner query returned plus a
      // clean empty state otherwise. Logged for ops.
      console.error("subscribePlayerHistory.participant error:", err)
      participantReady = true
      flush()
    },
  )

  return () => {
    unsubOwned()
    unsubParticipant()
  }
}

export function computeStat(
  pozo: Pozo,
  playerId: string,
  sort: StandingsSort,
): PlayerPozoStat {
  const standings = computeStandings(pozo.players, pozo.matches)
  const sorted = sortStandings(standings, sort, pozo.matches)
  const idx = sorted.findIndex((s) => s.player.id === playerId)
  const me = standings.find((s) => s.player.id === playerId)!
  return {
    pozoId: pozo.id,
    pozoName: pozo.name,
    groupId: pozo.groupId ?? null,
    date: pozo.finishedAt ?? pozo.createdAt,
    gamesWon: me.gamesWon,
    matchesWon: me.matchesWon,
    matchesLost: me.matchesLost,
    points: me.points,
    finalPosition: idx >= 0 ? idx + 1 : pozo.players.length,
  }
}
