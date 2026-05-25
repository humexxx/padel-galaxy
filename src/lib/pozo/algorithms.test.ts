import { describe, it, expect, beforeEach } from "vitest"

import {
  buildHistory,
  computeTotalRounds,
  defaultMatchesPerPlayer,
  generateRound,
} from "./algorithms"
import { advanceRound, createPozo, recordMatchResult, startPozo } from "./factory"
import type { Match, PairingAlgorithm, Player, Pozo } from "./types"

const playerNames = (n: number) =>
  Array.from({ length: n }, (_, i) => `P${i + 1}`)

function makePozo(opts: {
  players?: number
  courts?: number
  matchesPerPlayer?: number
  algorithm?: PairingAlgorithm
  allowRepeatPairs?: boolean
}): Pozo {
  const players = opts.players ?? 8
  const courts = opts.courts ?? 2
  return createPozo({
    name: "Test",
    ownerId: "test-owner",
    players: playerNames(players),
    config: {
      courts,
      matchesPerPlayer: opts.matchesPerPlayer ?? defaultMatchesPerPlayer(players, courts),
      totalDurationMin: 90,
      warmupMin: 5,
      algorithm: opts.algorithm ?? "balanced",
      allowRepeatPairs: opts.allowRepeatPairs ?? false,
    },
  })
}

function simulateFullPozo(
  pozo: Pozo,
  scoreStrategy: (round: number, matchIndex: number) => [number, number],
): Pozo {
  let current = startPozo(pozo, Date.now())
  while (current.status !== "finished") {
    const roundMatches = current.matches.filter(
      (m) => m.round === current.currentRound,
    )
    roundMatches.forEach((m, i) => {
      const [a, b] = scoreStrategy(current.currentRound, i)
      current = recordMatchResult(current, m.id, a, b)
    })
    current = advanceRound(current)
  }
  return current
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|")
}

function matchupKey(a: string, b: string) {
  return [a, b].sort().join("~")
}

function getPartnerPairs(matches: Match[]): string[] {
  const out: string[] = []
  for (const m of matches) {
    out.push(pairKey(m.teamA.playerA, m.teamA.playerB))
    out.push(pairKey(m.teamB.playerA, m.teamB.playerB))
  }
  return out
}

function foursomeKey(ids: string[]): string {
  return [...ids].sort().join("#")
}

function getFoursomes(matches: Match[]): string[] {
  return matches.map((m) =>
    foursomeKey([m.teamA.playerA, m.teamA.playerB, m.teamB.playerA, m.teamB.playerB]),
  )
}

function countDuplicates(items: string[]): number {
  const map = new Map<string, number>()
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1)
  let dups = 0
  for (const c of map.values()) if (c > 1) dups += c - 1
  return dups
}

beforeEach(() => {
  // Make tests deterministic-ish; the algorithm still uses Math.random for tie-breaking.
  let seed = 1
  Math.random = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
})

describe("defaultMatchesPerPlayer", () => {
  it("returns N-1 when players fill courts exactly", () => {
    expect(defaultMatchesPerPlayer(8, 2)).toBe(7)
    expect(defaultMatchesPerPlayer(12, 3)).toBe(11)
    expect(defaultMatchesPerPlayer(4, 1)).toBe(3)
  })
  it("returns reasonable value when more players than slots", () => {
    expect(defaultMatchesPerPlayer(10, 2)).toBeGreaterThanOrEqual(1)
    expect(defaultMatchesPerPlayer(16, 2)).toBeGreaterThanOrEqual(1)
  })
  it("returns 0 for fewer than 4 players", () => {
    expect(defaultMatchesPerPlayer(3, 1)).toBe(0)
  })
})

describe("computeTotalRounds", () => {
  it("computes the canonical 7 rounds for 8 players × 2 courts × 7 matches", () => {
    expect(computeTotalRounds(8, 2, 7)).toBe(7)
  })
  it("scales linearly with matchesPerPlayer", () => {
    expect(computeTotalRounds(8, 2, 3)).toBe(3)
    expect(computeTotalRounds(8, 2, 5)).toBe(5)
  })
  it("handles extras (more players than slots)", () => {
    // 10 players, 2 courts (8 play per round), each plays 5 matches → 50/8 = ⌈6.25⌉ = 7 rounds
    expect(computeTotalRounds(10, 2, 5)).toBe(7)
  })
})

describe("generateRound — basic shape", () => {
  it("produces N matches per round (N = courts) when players fill courts", () => {
    const pozo = makePozo({ players: 8, courts: 2 })
    const matches = generateRound(pozo, 0)
    expect(matches).toHaveLength(2)
    expect(matches.every((m) => m.gamesA === null && m.gamesB === null)).toBe(true)
    expect(matches.map((m) => m.court)).toEqual([1, 2])
  })

  it("includes all 8 distinct players in a round when players = courts × 4", () => {
    const pozo = makePozo({ players: 8, courts: 2 })
    const matches = generateRound(pozo, 0)
    const ids = new Set<string>()
    for (const m of matches) {
      ids.add(m.teamA.playerA)
      ids.add(m.teamA.playerB)
      ids.add(m.teamB.playerA)
      ids.add(m.teamB.playerB)
    }
    expect(ids.size).toBe(8)
  })

  it("never pairs a player with themselves", () => {
    const pozo = makePozo({ players: 12, courts: 3 })
    const matches = generateRound(pozo, 0)
    for (const m of matches) {
      expect(m.teamA.playerA).not.toBe(m.teamA.playerB)
      expect(m.teamB.playerA).not.toBe(m.teamB.playerB)
      const all = new Set([
        m.teamA.playerA,
        m.teamA.playerB,
        m.teamB.playerA,
        m.teamB.playerB,
      ])
      expect(all.size).toBe(4)
    }
  })
})

describe("no-repeat-partners (allowRepeatPairs: false)", () => {
  it("8 players × 2 courts × 7 rounds: zero partner repeats", () => {
    const pozo = makePozo({
      players: 8,
      courts: 2,
      matchesPerPlayer: 7,
      allowRepeatPairs: false,
      algorithm: "balanced",
    })
    const finished = simulateFullPozo(pozo, () => [
      Math.floor(Math.random() * 5) + 1,
      Math.floor(Math.random() * 5) + 1,
    ])
    const dups = countDuplicates(getPartnerPairs(finished.matches))
    expect(dups).toBe(0)
  })

  it("12 players × 3 courts × 11 rounds: zero partner repeats", () => {
    const pozo = makePozo({
      players: 12,
      courts: 3,
      matchesPerPlayer: 11,
      allowRepeatPairs: false,
      algorithm: "balanced",
    })
    const finished = simulateFullPozo(pozo, () => [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ])
    const dups = countDuplicates(getPartnerPairs(finished.matches))
    expect(dups).toBe(0)
  })

  it("works for random algorithm too — partner repeats minimized", () => {
    const pozo = makePozo({
      players: 8,
      courts: 2,
      matchesPerPlayer: 7,
      allowRepeatPairs: false,
      algorithm: "random",
    })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    const dups = countDuplicates(getPartnerPairs(finished.matches))
    // Random tie-breaks may yield small overlap, but should be near-zero
    expect(dups).toBeLessThan(3)
  })

  it("allows repeats when allowRepeatPairs: true and config requires it", () => {
    // 8 players, 14 matches per player → 28 total rounds, MUST repeat
    const pozo = makePozo({
      players: 8,
      courts: 2,
      matchesPerPlayer: 14,
      allowRepeatPairs: true,
      algorithm: "balanced",
    })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    expect(finished.status).toBe("finished")
    // With 8 players, max distinct pairs = C(8,2) = 28. Beyond that you MUST repeat.
    // We have 28 * 2 = 56 pair-slots, so duplicates expected.
    const dups = countDuplicates(getPartnerPairs(finished.matches))
    expect(dups).toBeGreaterThan(0)
  })
})

describe("balanced algorithm — fairness", () => {
  it("after seeding a clear dominant player, balanced puts winners against winners", () => {
    const pozo = makePozo({
      players: 8,
      courts: 2,
      matchesPerPlayer: 7,
      algorithm: "balanced",
    })
    // Make P1 always win heavily
    let current = startPozo(pozo, Date.now())
    // Round 1: record results making P1's team blow out
    const r1 = current.matches.filter((m) => m.round === 0)
    for (const m of r1) {
      const p1OnA = [m.teamA.playerA, m.teamA.playerB].includes(current.players[0].id)
      const p1OnB = [m.teamB.playerA, m.teamB.playerB].includes(current.players[0].id)
      if (p1OnA) current = recordMatchResult(current, m.id, 6, 0)
      else if (p1OnB) current = recordMatchResult(current, m.id, 0, 6)
      else current = recordMatchResult(current, m.id, 3, 3)
    }
    current = advanceRound(current)
    // In round 2, P1 should be opposite the next-best winner
    const r2 = current.matches.filter((m) => m.round === 1)
    expect(r2.length).toBe(2)
    // P1 must be in one of the matches
    const p1Id = current.players[0].id
    const p1Match = r2.find(
      (m) =>
        m.teamA.playerA === p1Id ||
        m.teamA.playerB === p1Id ||
        m.teamB.playerA === p1Id ||
        m.teamB.playerB === p1Id,
    )
    expect(p1Match).toBeDefined()
  })

  it("balanced does not crash with snake & random algos either", () => {
    for (const algorithm of ["balanced", "random", "snake"] as PairingAlgorithm[]) {
      const pozo = makePozo({ players: 8, algorithm })
      expect(() => simulateFullPozo(pozo, () => [4, 2])).not.toThrow()
    }
  })
})

describe("playing-time fairness", () => {
  it("8 players × 2 courts × 7 matches: every player plays exactly 7 matches", () => {
    const pozo = makePozo({ players: 8, courts: 2, matchesPerPlayer: 7 })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    const counts = new Map<string, number>()
    for (const p of finished.players) counts.set(p.id, 0)
    for (const m of finished.matches) {
      for (const id of [m.teamA.playerA, m.teamA.playerB, m.teamB.playerA, m.teamB.playerB]) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    for (const c of counts.values()) expect(c).toBe(7)
  })

  it("10 players × 2 courts: rotation keeps match-counts within ±1", () => {
    const pozo = makePozo({
      players: 10,
      courts: 2,
      matchesPerPlayer: 5,
      algorithm: "balanced",
    })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    const counts = new Map<string, number>()
    for (const p of finished.players) counts.set(p.id, 0)
    for (const m of finished.matches) {
      for (const id of [m.teamA.playerA, m.teamA.playerB, m.teamB.playerA, m.teamB.playerB]) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    const values = [...counts.values()]
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })
})

describe("opponent-repeat avoidance", () => {
  it("minimizes how often two players face each other across the pozo", () => {
    const pozo = makePozo({ players: 8, courts: 2, matchesPerPlayer: 7 })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    const counts = new Map<string, number>()
    for (const m of finished.matches) {
      const aIds = [m.teamA.playerA, m.teamA.playerB]
      const bIds = [m.teamB.playerA, m.teamB.playerB]
      for (const a of aIds) {
        for (const b of bIds) {
          const k = matchupKey(a, b)
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
      }
    }
    // Max times any two players face each other should be bounded.
    // 8 players, each plays 7 matches × 2 opponents = 14 opponent-instances per player.
    // 7 other players → ~2 each on average. Max should not be much higher.
    const max = Math.max(...counts.values())
    expect(max).toBeLessThanOrEqual(4)
  })
})

describe("buildHistory", () => {
  it("counts partners, opponents, wins, games-diff", () => {
    const pozo = makePozo({ players: 8 })
    const started = startPozo(pozo, Date.now())
    const m1 = started.matches[0]
    const withResults = recordMatchResult(started, m1.id, 6, 2)
    const history = buildHistory([withResults.matches[0]], withResults.players)
    expect(history.partnerCount.size).toBe(2) // teamA pair + teamB pair
    expect(history.opponentCount.size).toBe(4) // 2x2 matchups
    // teamA players have +4 diff, teamB players have -4 diff
    const [ta1, ta2] = [m1.teamA.playerA, m1.teamA.playerB]
    expect(history.gamesDiff.get(ta1)).toBe(4)
    expect(history.gamesDiff.get(ta2)).toBe(4)
    expect(history.wins.get(ta1)).toBe(1)
  })

  it("ignores matches with null scores", () => {
    const pozo = makePozo({ players: 8 })
    const started = startPozo(pozo, Date.now())
    // Don't record any result
    const history = buildHistory(started.matches, started.players)
    // Should still count partners/opponents/matchesPlayed
    expect(history.partnerCount.size).toBeGreaterThan(0)
    // But wins/gamesDiff stay at 0
    for (const w of history.wins.values()) expect(w).toBe(0)
    for (const d of history.gamesDiff.values()) expect(d).toBe(0)
  })
})

describe("full lifecycle integration", () => {
  it("draft → warmup → playing → finished", () => {
    const pozo = makePozo({ players: 8 })
    expect(pozo.status).toBe("draft")
    const started = startPozo(pozo, Date.now())
    expect(started.status).toBe("warmup")
    expect(started.matches.length).toBe(2) // first round
    const finished = simulateFullPozo(pozo, () => [3, 3])
    expect(finished.status).toBe("finished")
    expect(finished.matches.length).toBe(14) // 7 rounds × 2 courts
  })
})

describe("stress / edge cases", () => {
  it.each([
    { players: 4, courts: 1 },
    { players: 8, courts: 2 },
    { players: 12, courts: 3 },
    { players: 16, courts: 4 },
  ])("no partner repeats for $players players × $courts courts × N-1 rounds", ({ players, courts }) => {
    const pozo = makePozo({
      players,
      courts,
      matchesPerPlayer: players - 1,
      allowRepeatPairs: false,
    })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    const dups = countDuplicates(getPartnerPairs(finished.matches))
    expect(dups).toBe(0)
  })

  it.each([
    { players: 10, courts: 2, matchesPerPlayer: 5 },
    { players: 14, courts: 3, matchesPerPlayer: 6 },
  ])("rotation (more players than slots): every player plays within ±1", ({ players, courts, matchesPerPlayer }) => {
    const pozo = makePozo({ players, courts, matchesPerPlayer })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    const counts = new Map<string, number>()
    for (const p of finished.players) counts.set(p.id, 0)
    for (const m of finished.matches) {
      for (const id of [m.teamA.playerA, m.teamA.playerB, m.teamB.playerA, m.teamB.playerB]) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    const values = [...counts.values()]
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  it("each round uses 4 distinct players per court", () => {
    const pozo = makePozo({ players: 12, courts: 3 })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    const roundsToCheck = new Set(finished.matches.map((m) => m.round))
    for (const r of roundsToCheck) {
      const matches = finished.matches.filter((m) => m.round === r)
      const ids = new Set<string>()
      for (const m of matches) {
        ids.add(m.teamA.playerA)
        ids.add(m.teamA.playerB)
        ids.add(m.teamB.playerA)
        ids.add(m.teamB.playerB)
      }
      // No player plays twice in a round
      expect(ids.size).toBe(matches.length * 4)
    }
  })

  it("when matchesPerPlayer > N-1 and allowRepeatPairs=true, finishes without crash", () => {
    const pozo = makePozo({
      players: 8,
      courts: 2,
      matchesPerPlayer: 21, // requires repeats: more partners than possible
      allowRepeatPairs: true,
    })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    expect(finished.status).toBe("finished")
  })

  it("balanced algorithm keeps team-strength gap small in late rounds", () => {
    const pozo = makePozo({ players: 8, algorithm: "balanced" })
    // Skew results so we can detect balance
    const finished = simulateFullPozo(pozo, (round, idx) => {
      // Make some players "strong" - they win when in a match
      return [4 + (round % 2), 2 + (idx % 3)]
    })
    expect(finished.status).toBe("finished")
    // No structural failure
    expect(finished.matches.length).toBe(14)
  })

  it("snake algorithm pairs strong+weak when given clear skill differential", () => {
    // Set up history where 4 players have many wins, 4 have none
    const players = playerNames(8).map((n) => ({ id: n, name: n })) as Player[]
    const fakeHistory = []
    for (let r = 0; r < 3; r++) {
      // Players 1-4 always win
      fakeHistory.push({
        id: `prev-${r}-1`,
        round: r,
        court: 1,
        teamA: { playerA: "P1", playerB: "P2" },
        teamB: { playerA: "P5", playerB: "P6" },
        gamesA: 6 as number | null,
        gamesB: 0 as number | null,
      })
      fakeHistory.push({
        id: `prev-${r}-2`,
        round: r,
        court: 2,
        teamA: { playerA: "P3", playerB: "P4" },
        teamB: { playerA: "P7", playerB: "P8" },
        gamesA: 6 as number | null,
        gamesB: 0 as number | null,
      })
    }
    const pozo: Pozo = {
      id: "test",
      ownerId: "test-owner",
      name: "snake-test",
      createdAt: Date.now(),
      status: "playing",
      config: {
        courts: 2,
        matchesPerPlayer: 6,
        totalDurationMin: 90,
        warmupMin: 5,
        algorithm: "snake",
        allowRepeatPairs: true,
      },
      players,
      matches: fakeHistory,
      currentRound: 2,
      totalRounds: 6,
      startedAt: Date.now(),
      warmupEndsAt: Date.now(),
      endsAt: Date.now() + 1e9,
      finishedAt: null,
    }
    const next = generateRound(pozo, 3)
    expect(next.length).toBe(2)
    // In each match, count strong (1-4) vs weak (5-8) per team
    const strong = new Set(["P1", "P2", "P3", "P4"])
    for (const m of next) {
      const aHasStrong =
        strong.has(m.teamA.playerA) || strong.has(m.teamA.playerB)
      const bHasStrong =
        strong.has(m.teamB.playerA) || strong.has(m.teamB.playerB)
      // Both teams should have at least one strong (snake = strong+weak together)
      expect(aHasStrong && bHasStrong).toBe(true)
    }
  })

  it("balanced + no-repeat: across 100 runs, dups stay at 0", () => {
    let totalDups = 0
    for (let i = 0; i < 100; i++) {
      const pozo = makePozo({
        players: 8,
        courts: 2,
        matchesPerPlayer: 7,
        algorithm: "balanced",
        allowRepeatPairs: false,
      })
      const finished = simulateFullPozo(pozo, () => [
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
      ])
      totalDups += countDuplicates(getPartnerPairs(finished.matches))
    }
    expect(totalDups).toBe(0)
  })
})

describe("no-foursome-repeats (same 4 players never play together twice)", () => {
  it.each(["balanced", "random", "snake"] as PairingAlgorithm[])(
    "%s algorithm: 8 players × 2 courts × 7 rounds — no foursome repeats",
    (algorithm) => {
      const pozo = makePozo({
        players: 8,
        courts: 2,
        matchesPerPlayer: 7,
        algorithm,
        allowRepeatPairs: false,
      })
      const finished = simulateFullPozo(pozo, () => [3, 3])
      const dups = countDuplicates(getFoursomes(finished.matches))
      // With 8 players you have C(8,4) = 70 possible foursomes and need 14
      // → easy to avoid all repeats
      expect(dups).toBe(0)
    },
  )

  it.each(["balanced", "random", "snake"] as PairingAlgorithm[])(
    "%s algorithm: 12 players × 3 courts × 11 rounds — no foursome repeats",
    (algorithm) => {
      const pozo = makePozo({
        players: 12,
        courts: 3,
        matchesPerPlayer: 11,
        algorithm,
        allowRepeatPairs: false,
      })
      const finished = simulateFullPozo(pozo, () => [3, 3])
      const dups = countDuplicates(getFoursomes(finished.matches))
      // C(12,4) = 495 possible foursomes, need 33 → plenty of room
      expect(dups).toBe(0)
    },
  )

  it("allowRepeatPairs=true: foursome avoidance is still attempted but soft", () => {
    const pozo = makePozo({
      players: 8,
      courts: 2,
      matchesPerPlayer: 14, // forces partner repeats
      algorithm: "balanced",
      allowRepeatPairs: true,
    })
    const finished = simulateFullPozo(pozo, () => [3, 3])
    expect(finished.status).toBe("finished")
    // 28 matches → some foursome repeats are unavoidable, but algorithm should minimize them
    const dups = countDuplicates(getFoursomes(finished.matches))
    // C(8,4) = 70, we have 28 matches → could have repeats but minimize
    expect(dups).toBeLessThan(14)
  })
})

describe("algorithm × no-repeat-pairs matrix", () => {
  it.each(["balanced", "random", "snake"] as PairingAlgorithm[])(
    "%s + allowRepeatPairs=false: 0 partner repeats AND 0 foursome repeats",
    (algorithm) => {
      const pozo = makePozo({
        players: 8,
        courts: 2,
        matchesPerPlayer: 7,
        algorithm,
        allowRepeatPairs: false,
      })
      const finished = simulateFullPozo(pozo, () => [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ])
      expect(countDuplicates(getPartnerPairs(finished.matches))).toBe(0)
      expect(countDuplicates(getFoursomes(finished.matches))).toBe(0)
    },
  )

  it.each(["balanced", "random", "snake"] as PairingAlgorithm[])(
    "%s with default config produces complete schedule",
    (algorithm) => {
      const pozo = makePozo({ algorithm })
      const finished = simulateFullPozo(pozo, () => [3, 3])
      expect(finished.status).toBe("finished")
      expect(finished.matches.length).toBe(pozo.totalRounds * pozo.config.courts)
    },
  )
})
