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
  /** How many players the pozo had — the scale a position is out of. */
  playerCount: number
  /** Games this player accumulated in the pozo (sum across all their matches). */
  gamesWon: number
  /** Matches the player's team won. */
  matchesWon: number
  /** matchesPlayed - matchesWon - matchesTied (real losses, not ties). */
  matchesLost: number
  /** Tournament-style: 3 * win + 1 * tie. */
  points: number
  /** Final position (1-based) under the ranking the caller picked. */
  finalPosition: number
}

const COLLECTION = "pozos"

/**
 * Who is looking, which decides which pozos they're allowed to read.
 *
 * An admin can read every pozo (see the `isAdmin()` read rule), so their
 * view of a player is the player's whole history, whoever organized each
 * pozo. Everyone else can only read pozos they own or play in, so a
 * cliente sees their own history in full and, on someone else's profile,
 * the pozos they shared with that player.
 */
export type HistoryViewer = { uid: string; isAdmin: boolean }

/**
 * Subscribe to the FINISHED pozos that include `playerId`.
 *
 * Pozos store players as objects, so "contains player X" can't be a
 * Firestore filter without a denormalized field; each branch fetches what
 * the viewer can read and filters in memory.
 */
export function subscribePlayerPozos(
  viewer: HistoryViewer,
  playerId: string,
  onData: (pozos: Pozo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const keep = (pozos: Iterable<Pozo>) =>
    [...pozos].filter(
      (p) => p.status === "finished" && p.players.some((x) => x.id === playerId),
    )

  if (viewer.isAdmin) {
    // Single-field equality: served by the automatic index.
    const q = query(collection(db, COLLECTION), where("status", "==", "finished"))
    return onSnapshot(
      q,
      (snap) => onData(keep(snap.docs.map((d) => d.data() as Pozo))),
      onError,
    )
  }

  let owned: Pozo[] = []
  let participant: Pozo[] = []
  let ownedReady = false
  let participantReady = false

  function flush() {
    if (!ownedReady || !participantReady) return
    const byId = new Map<string, Pozo>()
    for (const p of owned) byId.set(p.id, p)
    for (const p of participant) byId.set(p.id, p)
    onData(keep(byId.values()))
  }

  // Either branch failing (a denied read, an index still building) must
  // not blank the other, so each marks itself ready and flushes.
  const unsubOwned = onSnapshot(
    query(collection(db, COLLECTION), where("ownerId", "==", viewer.uid)),
    (snap) => {
      owned = snap.docs.map((d) => d.data() as Pozo)
      ownedReady = true
      flush()
    },
    (err) => {
      onError?.(err)
      ownedReady = true
      flush()
    },
  )
  const unsubParticipant = onSnapshot(
    query(
      collection(db, COLLECTION),
      where("linkedUids", "array-contains", viewer.uid),
    ),
    (snap) => {
      participant = snap.docs.map((d) => d.data() as Pozo)
      participantReady = true
      flush()
    },
    (err) => {
      onError?.(err)
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
): PlayerPozoStat | null {
  const standings = computeStandings(pozo.players, pozo.matches)
  const me = standings.find((s) => s.player.id === playerId)
  if (!me) return null
  const sorted = sortStandings(standings, sort, pozo.matches)
  const idx = sorted.findIndex((s) => s.player.id === playerId)
  return {
    pozoId: pozo.id,
    pozoName: pozo.name,
    groupId: pozo.groupId ?? null,
    date: pozo.finishedAt ?? pozo.createdAt,
    playerCount: pozo.players.length,
    gamesWon: me.gamesWon,
    matchesWon: me.matchesWon,
    matchesLost: me.matchesLost,
    points: me.points,
    finalPosition: idx + 1,
  }
}

/** One stat per pozo, oldest first so a chart reads left to right. */
export function buildPlayerHistory(
  pozos: Pozo[],
  playerId: string,
  sort: StandingsSort,
): PlayerPozoStat[] {
  return pozos
    .map((p) => computeStat(p, playerId, sort))
    .filter((s): s is PlayerPozoStat => s !== null)
    .sort((a, b) => a.date - b.date)
}

export type HistorySummary = {
  pozos: number
  wins: number
  podiums: number
  bestPosition: number | null
  averagePosition: number | null
}

export function summarizeHistory(stats: PlayerPozoStat[]): HistorySummary {
  if (stats.length === 0) {
    return { pozos: 0, wins: 0, podiums: 0, bestPosition: null, averagePosition: null }
  }
  const positions = stats.map((s) => s.finalPosition)
  const total = positions.reduce((a, b) => a + b, 0)
  return {
    pozos: stats.length,
    wins: positions.filter((p) => p === 1).length,
    podiums: positions.filter((p) => p <= 3).length,
    bestPosition: Math.min(...positions),
    averagePosition: Math.round((total / positions.length) * 10) / 10,
  }
}
