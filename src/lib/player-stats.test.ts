import { describe, expect, it } from "vitest"

import {
  buildPlayerHistory,
  computeStat,
  summarizeHistory,
  type PlayerPozoStat,
} from "@/lib/player-stats"
import type { Match, Player, Pozo } from "@/lib/pozo/types"

const players: Player[] = [
  { id: "A", name: "Ana" },
  { id: "B", name: "Bruno" },
  { id: "C", name: "Carla" },
  { id: "D", name: "Diego" },
]

function match(
  ta: [string, string],
  tb: [string, string],
  ga: number,
  gb: number,
): Match {
  return {
    id: `${ta.join("")}-${tb.join("")}-${ga}-${gb}`,
    round: 0,
    court: 1,
    teamA: { playerA: ta[0], playerB: ta[1] },
    teamB: { playerA: tb[0], playerB: tb[1] },
    gamesA: ga,
    gamesB: gb,
  }
}

function pozo(over: Partial<Pozo>): Pozo {
  return {
    id: "p1",
    ownerId: "someone-else",
    name: "Pozo",
    createdAt: 0,
    status: "finished",
    config: {
      courts: 1,
      matchesPerPlayer: 3,
      totalDurationMin: 90,
      warmupMin: 5,
      algorithm: "balanced",
      allowRepeatPairs: false,
    },
    players,
    matches: [
      match(["A", "B"], ["C", "D"], 6, 2),
      match(["A", "C"], ["B", "D"], 6, 3),
      match(["A", "D"], ["B", "C"], 6, 1),
    ],
    currentRound: 2,
    totalRounds: 3,
    startedAt: 0,
    warmupEndsAt: 0,
    endsAt: 0,
    finishedAt: 1_000,
    ...over,
  }
}

describe("computeStat", () => {
  it("reads the player's games, record and position out of the pozo", () => {
    const stat = computeStat(pozo({}), "A", "games")!
    expect(stat.gamesWon).toBe(18)
    expect(stat.matchesWon).toBe(3)
    expect(stat.matchesLost).toBe(0)
    expect(stat.points).toBe(9)
    expect(stat.finalPosition).toBe(1)
    expect(stat.playerCount).toBe(4)
  })

  it("dates a pozo by when it finished, falling back to creation", () => {
    expect(computeStat(pozo({ finishedAt: 5_000 }), "A", "games")!.date).toBe(5_000)
    expect(
      computeStat(pozo({ finishedAt: null, createdAt: 42 }), "A", "games")!.date,
    ).toBe(42)
  })

  it("returns null for a player who wasn't in the pozo", () => {
    expect(computeStat(pozo({}), "Z", "games")).toBeNull()
  })
})

describe("buildPlayerHistory", () => {
  it("orders the pozos oldest first regardless of input order", () => {
    const history = buildPlayerHistory(
      [
        pozo({ id: "late", finishedAt: 3_000 }),
        pozo({ id: "early", finishedAt: 1_000 }),
        pozo({ id: "mid", finishedAt: 2_000 }),
      ],
      "A",
      "games",
    )
    expect(history.map((h) => h.pozoId)).toEqual(["early", "mid", "late"])
  })

  it("re-ranks positions when the metric changes", () => {
    // Carla wins once by a lot; Bruno wins twice by one game each.
    // Games: Ana 8, Carla 7, Bruno 2, Diego 1 → Carla 2nd.
    // Matches won: Ana 2, Bruno 2, Carla 1, Diego 1 → Carla 3rd at best.
    const p = pozo({
      matches: [
        match(["B", "A"], ["C", "D"], 1, 0),
        match(["B", "D"], ["C", "A"], 1, 0),
        match(["C", "A"], ["B", "D"], 7, 0),
      ],
    })
    expect(buildPlayerHistory([p], "C", "games")[0].finalPosition).toBe(2)
    expect(
      buildPlayerHistory([p], "C", "matchesWon")[0].finalPosition,
    ).toBeGreaterThanOrEqual(3)
  })
})

describe("summarizeHistory", () => {
  function stat(finalPosition: number): PlayerPozoStat {
    return {
      pozoId: String(finalPosition),
      pozoName: "x",
      groupId: null,
      date: 0,
      playerCount: 8,
      gamesWon: 0,
      matchesWon: 0,
      matchesLost: 0,
      points: 0,
      finalPosition,
    }
  }

  it("is empty without pozos", () => {
    expect(summarizeHistory([])).toEqual({
      pozos: 0,
      wins: 0,
      podiums: 0,
      bestPosition: null,
      averagePosition: null,
    })
  })

  it("counts wins and podiums and averages the position", () => {
    expect(summarizeHistory([1, 3, 4, 1].map(stat))).toEqual({
      pozos: 4,
      wins: 2,
      podiums: 3,
      bestPosition: 1,
      averagePosition: 2.3,
    })
  })
})
