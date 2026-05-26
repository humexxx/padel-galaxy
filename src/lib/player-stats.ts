import {
  collection,
  onSnapshot,
  orderBy,
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
 * a custom field, so we fetch all of the owner's pozos and filter in-memory.
 * For a typical organizer with tens of pozos, this is fine; if it gets to
 * thousands we'll denormalize `playerIds: string[]` onto the pozo doc.
 */
export function subscribePlayerHistory(
  ownerId: string,
  playerId: string,
  sort: StandingsSort,
  onData: (stats: PlayerPozoStat[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where("ownerId", "==", ownerId),
    orderBy("createdAt", "asc"),
  )
  return onSnapshot(
    q,
    (snap) => {
      const stats: PlayerPozoStat[] = []
      for (const d of snap.docs) {
        const pozo = d.data() as Pozo
        if (pozo.status !== "finished") continue
        if (!pozo.players.some((p) => p.id === playerId)) continue
        stats.push(computeStat(pozo, playerId, sort))
      }
      onData(stats)
    },
    onError,
  )
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
