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
  return {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    groupId: input.groupId,
    name: input.name.trim() || "Pozo sin nombre",
    createdAt: Date.now(),
    status: "draft",
    config: input.config,
    players,
    matches: [],
    currentRound: 0,
    totalRounds,
    startedAt: null,
    warmupEndsAt: null,
    endsAt: null,
    finishedAt: null,
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

export function beginPlay(pozo: Pozo): Pozo {
  if (pozo.status !== "warmup") return pozo
  return { ...pozo, status: "playing" }
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

export function advanceRound(pozo: Pozo): Pozo {
  if (!isRoundComplete(pozo)) return pozo
  const nextRoundIndex = pozo.currentRound + 1
  if (nextRoundIndex >= pozo.totalRounds) {
    return {
      ...pozo,
      status: "finished",
      finishedAt: Date.now(),
      currentRound: pozo.totalRounds - 1,
    }
  }
  const nextMatches = generateRound(pozo, nextRoundIndex)
  return {
    ...pozo,
    matches: [...pozo.matches, ...nextMatches],
    currentRound: nextRoundIndex,
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
