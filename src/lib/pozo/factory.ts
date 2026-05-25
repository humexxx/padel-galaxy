import { computeTotalRounds, generateRound } from "./algorithms"
import type { Match, Player, Pozo, PozoConfig } from "./types"

export const DEFAULT_CONFIG: PozoConfig = {
  courts: 2,
  matchesPerPlayer: 7,
  totalDurationMin: 90,
  warmupMin: 5,
  algorithm: "balanced",
  allowRepeatPairs: false,
}

export function createPozo(input: {
  name: string
  players: string[]
  config: PozoConfig
  ownerId: string
}): Pozo {
  const players: Player[] = input.players.map((name) => ({
    id: crypto.randomUUID(),
    name: name.trim(),
  }))
  const totalRounds = computeTotalRounds(
    players.length,
    input.config.courts,
    input.config.matchesPerPlayer,
  )
  return {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
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
  const totalMs = pozo.config.totalDurationMin * 60_000
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
  const playMin = Math.max(0, config.totalDurationMin - config.warmupMin)
  return playMin / totalRounds
}
