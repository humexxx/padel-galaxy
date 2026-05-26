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
import type { PlayerStanding, Pozo } from "@/lib/pozo/types"

export type CalendarPeriod = "month" | "quarter" | "semester" | "year"

export const PERIOD_LABELS: Record<CalendarPeriod, string> = {
  month: "Mes actual",
  quarter: "Trimestre actual",
  semester: "Semestre actual",
  year: "Año actual",
}

/** Inclusive start, exclusive end. Both in millis since epoch. */
export type DateRange = { start: number; end: number }

export function rangeFor(period: CalendarPeriod, now = new Date()): DateRange {
  const year = now.getFullYear()
  const month = now.getMonth()
  switch (period) {
    case "month": {
      const start = new Date(year, month, 1).getTime()
      const end = new Date(year, month + 1, 1).getTime()
      return { start, end }
    }
    case "quarter": {
      const qStart = Math.floor(month / 3) * 3
      const start = new Date(year, qStart, 1).getTime()
      const end = new Date(year, qStart + 3, 1).getTime()
      return { start, end }
    }
    case "semester": {
      const sStart = month < 6 ? 0 : 6
      const start = new Date(year, sStart, 1).getTime()
      const end = new Date(year, sStart + 6, 1).getTime()
      return { start, end }
    }
    case "year": {
      const start = new Date(year, 0, 1).getTime()
      const end = new Date(year + 1, 0, 1).getTime()
      return { start, end }
    }
  }
}

/**
 * ISO 8601 week key, "YYYY-Www". Week starts Monday. Used by the
 * "best per week" filter to collapse multiple pozos in the same calendar
 * week to the player's best one.
 */
export function isoWeekKey(date: Date): string {
  // Copy to avoid mutating; normalize to UTC midnight.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // ISO week computation per https://en.wikipedia.org/wiki/ISO_week_date
  // Shift to nearest Thursday: current date + 4 - current day number.
  // Sunday is day 0 in JS; ISO treats it as 7.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

/** Subscribe to all pozos belonging to `groupId` for the current owner. */
export function subscribeGroupPozos(
  ownerId: string,
  groupId: string,
  onData: (pozos: Pozo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, "pozos"),
    where("ownerId", "==", ownerId),
    where("groupId", "==", groupId),
    orderBy("createdAt", "asc"),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Pozo)),
    onError,
  )
}

/** One row per (player, pozo) pair — used for chart points + aggregation. */
export type PlayerPozoEntry = {
  date: number
  weekKey: string
  pozoId: string
  pozoName: string
  playerId: string
  playerName: string
  gamesWon: number
  gamesLost: number
  gamesDiff: number
  matchesPlayed: number
  matchesWon: number
  matchesTied: number
  matchesLost: number
  points: number
}

/** Aggregated row across all pozos in the period — one per player. */
export type GroupAggregate = PlayerStanding & {
  pozosPlayed: number
}

export type AggregateOptions = {
  /** When true, for each (player, week) keep ONLY the pozo where the
   * player had the highest value for the sort metric. Affects both the
   * chart entries and the aggregate totals. */
  bestPerWeek?: boolean
}

const metricKey: Record<StandingsSort, keyof PlayerPozoEntry> = {
  games: "gamesWon",
  matchesWon: "matchesWon",
  points: "points",
}

/**
 * Compute per-player aggregated standings AND per-pozo chart entries from a
 * set of pozos. Only counts FINISHED pozos in [range.start, range.end).
 */
/**
 * "Typical" pozo size for a set of pozos. We prefer the **mode** (most
 * common player count) because organizers usually run pozos of a fixed
 * size — e.g. 8, 8, 8, 16 → 8, not the arithmetic mean of 10. When all
 * sizes are unique (no mode), fall back to the rounded median, which is
 * still more robust than the mean against single-outlier pozos.
 *
 * Ties at the max frequency resolve to the smallest tied value (more
 * conservative for default chart visibility — fewer crowded lines).
 */
export function typicalPlayersPerPozo(pozos: Pozo[]): number {
  if (pozos.length === 0) return 0
  const counts = pozos.map((p) => p.players.length).sort((a, b) => a - b)
  const freq = new Map<number, number>()
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1)
  const maxFreq = Math.max(...freq.values())
  if (maxFreq >= 2) {
    let mode = Infinity
    for (const [val, f] of freq) {
      if (f === maxFreq && val < mode) mode = val
    }
    return mode
  }
  // All sizes unique — use the rounded median.
  const mid = Math.floor(counts.length / 2)
  return counts.length % 2 === 0
    ? Math.round((counts[mid - 1] + counts[mid]) / 2)
    : counts[mid]
}

export function aggregateGroup(
  pozos: Pozo[],
  range: DateRange,
  sort: StandingsSort,
  options: AggregateOptions = {},
): {
  aggregate: GroupAggregate[]
  entries: PlayerPozoEntry[]
  pozosInRange: number
  typicalPlayersPerPozo: number
} {
  const inRange = pozos.filter((p) => {
    const t = p.finishedAt ?? p.createdAt
    return p.status === "finished" && t >= range.start && t < range.end
  })

  let allEntries: PlayerPozoEntry[] = []
  for (const pozo of inRange) {
    const standings = computeStandings(pozo.players, pozo.matches)
    const date = pozo.finishedAt ?? pozo.createdAt
    const weekKey = isoWeekKey(new Date(date))
    for (const s of standings) {
      if (s.matchesPlayed === 0) continue
      allEntries.push({
        date,
        weekKey,
        pozoId: pozo.id,
        pozoName: pozo.name,
        playerId: s.player.id,
        playerName: s.player.name,
        gamesWon: s.gamesWon,
        gamesLost: s.gamesLost,
        gamesDiff: s.gamesDiff,
        matchesPlayed: s.matchesPlayed,
        matchesWon: s.matchesWon,
        matchesTied: s.matchesTied,
        matchesLost: s.matchesLost,
        points: s.points,
      })
    }
  }

  // Best-per-week filter: per (playerId, weekKey), keep only the entry with
  // the highest value of the selected metric. Ties keep the earlier entry.
  if (options.bestPerWeek) {
    const key = metricKey[sort]
    const best = new Map<string, PlayerPozoEntry>()
    for (const e of allEntries) {
      const k = `${e.playerId}::${e.weekKey}`
      const existing = best.get(k)
      if (!existing || (e[key] as number) > (existing[key] as number)) {
        best.set(k, e)
      }
    }
    allEntries = [...best.values()].sort((a, b) => a.date - b.date)
  }

  // Build aggregate totals from the (possibly-filtered) entries.
  const totals = new Map<string, GroupAggregate>()
  for (const e of allEntries) {
    const existing = totals.get(e.playerId)
    if (existing) {
      existing.matchesPlayed += e.matchesPlayed
      existing.matchesWon += e.matchesWon
      existing.matchesTied += e.matchesTied
      existing.matchesLost += e.matchesLost
      existing.gamesWon += e.gamesWon
      existing.gamesLost += e.gamesLost
      existing.gamesDiff += e.gamesDiff
      existing.points += e.points
      existing.pozosPlayed += 1
    } else {
      totals.set(e.playerId, {
        player: { id: e.playerId, name: e.playerName },
        matchesPlayed: e.matchesPlayed,
        matchesWon: e.matchesWon,
        matchesTied: e.matchesTied,
        matchesLost: e.matchesLost,
        gamesWon: e.gamesWon,
        gamesLost: e.gamesLost,
        gamesDiff: e.gamesDiff,
        points: e.points,
        pozosPlayed: 1,
      })
    }
  }

  // H2H tiebreaking isn't useful across multiple pozos in this aggregation
  // (head-to-head varies wildly across pozos and would require complex joins).
  // Pass empty matches; the sort falls back to gamesDiff / name.
  const aggregate = sortStandings(
    [...totals.values()],
    sort,
    [],
  ) as GroupAggregate[]

  return {
    aggregate,
    entries: allEntries,
    pozosInRange: inRange.length,
    typicalPlayersPerPozo: typicalPlayersPerPozo(inRange),
  }
}
