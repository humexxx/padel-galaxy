import { computeTotalRounds, generateRound } from "./algorithms"
import type { Match, Player, Pozo, PozoConfig } from "./types"

export const DEFAULT_CONFIG: PozoConfig = {
  courts: 2,
  matchesPerPlayer: 7,
  totalDurationMin: 90,
  warmupMin: 5,
  warmupIncludedInTotal: true,
  algorithm: "balanced",
  allowRepeatPairs: false,
}

export function createPozo(input: {
  name: string
  /** Each player must already have a stable id (either a Firestore players
   * collection id, or a one-off uuid for ad-hoc players). The factory does
   * NOT generate ids — that's the caller's job so the player record and
   * the pozo can be linked. */
  players: Array<{ id: string; name: string }>
  config: PozoConfig
  ownerId: string
  /** Required for pozos created from the UI. The migration script may
   * temporarily create pozos without one, then backfill. */
  groupId?: string
  /** UIDs of player accounts already linked at creation time. Populated
   * by the caller from the roster; used so participants can query
   * `where('linkedUids', 'array-contains', myUid)`. */
  linkedUids?: string[]
}): Pozo {
  const players: Player[] = input.players.map((p) => ({
    id: p.id,
    name: p.name.trim(),
  }))
  const totalRounds = computeTotalRounds(
    players.length,
    input.config.courts,
    input.config.matchesPerPlayer,
  )
  // Dedup + drop empties so the array-contains query doesn't get fooled by
  // duplicate entries when the same user is linked to multiple player IDs.
  const linkedUids = Array.from(
    new Set((input.linkedUids ?? []).filter((u) => typeof u === "string" && u.length > 0)),
  )
  return {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    groupId: input.groupId,
    name: input.name.trim() || "Pozo sin nombre",
    createdAt: Date.now(),
    status: "draft",
    config: input.config,
    players,
    linkedUids,
    matches: [],
    currentRound: 0,
    totalRounds,
    startedAt: null,
    warmupEndsAt: null,
    endsAt: null,
    finishedAt: null,
    roundStartedAt: null,
  }
}

export function startPozo(pozo: Pozo, now: number = Date.now()): Pozo {
  if (pozo.status !== "draft") return pozo
  const warmupMs = pozo.config.warmupMin * 60_000
  const configuredMs = pozo.config.totalDurationMin * 60_000
  const included = pozo.config.warmupIncludedInTotal ?? true
  // Wall-clock duration of the whole pozo. When warmup is included in the
  // total, it occupies the first warmupMs of configuredMs. When not, the
  // warmup is added on top.
  const totalMs = included ? configuredMs : warmupMs + configuredMs
  const firstRound = generateRound(pozo, 0)
  return {
    ...pozo,
    status: "warmup",
    startedAt: now,
    warmupEndsAt: now + warmupMs,
    endsAt: now + totalMs,
    matches: firstRound,
    currentRound: 0,
  }
}

export function beginPlay(pozo: Pozo, now: number = Date.now()): Pozo {
  if (pozo.status !== "warmup") return pozo
  return { ...pozo, status: "playing", roundStartedAt: now }
}

export function getCurrentMatches(pozo: Pozo): Match[] {
  return pozo.matches.filter((m) => m.round === pozo.currentRound)
}

export function isRoundComplete(pozo: Pozo): boolean {
  const current = getCurrentMatches(pozo)
  if (current.length === 0) return false
  return current.every((m) => m.gamesA !== null && m.gamesB !== null)
}

export function recordMatchResult(
  pozo: Pozo,
  matchId: string,
  gamesA: number,
  gamesB: number,
): Pozo {
  return {
    ...pozo,
    matches: pozo.matches.map((m) =>
      m.id === matchId ? { ...m, gamesA, gamesB } : m,
    ),
  }
}

export function advanceRound(pozo: Pozo, now: number = Date.now()): Pozo {
  if (!isRoundComplete(pozo)) return pozo
  const nextRoundIndex = pozo.currentRound + 1
  if (nextRoundIndex >= pozo.totalRounds) {
    return {
      ...pozo,
      status: "finished",
      finishedAt: now,
      currentRound: pozo.totalRounds - 1,
    }
  }
  const nextMatches = generateRound(pozo, nextRoundIndex)
  return {
    ...pozo,
    matches: [...pozo.matches, ...nextMatches],
    currentRound: nextRoundIndex,
    roundStartedAt: now,
  }
}

export function finishPozo(pozo: Pozo): Pozo {
  if (pozo.status === "finished") return pozo
  return { ...pozo, status: "finished", finishedAt: Date.now() }
}

export function computeMatchDurationMin(config: PozoConfig, totalRounds: number): number {
  if (totalRounds <= 0) return 0
  const included = config.warmupIncludedInTotal ?? true
  const playMin = included
    ? Math.max(0, config.totalDurationMin - config.warmupMin)
    : config.totalDurationMin
  return playMin / totalRounds
}

/**
 * When the CURRENT round's clock runs out, in epoch millis. Null when the
 * pozo isn't in play or predates `roundStartedAt` (legacy docs) — callers
 * fall back to the whole-pozo `endsAt` countdown in that case.
 */
export function computeRoundEndsAt(pozo: Pozo): number | null {
  if (pozo.status !== "playing") return null
  if (typeof pozo.roundStartedAt !== "number") return null
  const matchMs = computeMatchDurationMin(pozo.config, pozo.totalRounds) * 60_000
  if (matchMs <= 0) return null
  return pozo.roundStartedAt + matchMs
}
