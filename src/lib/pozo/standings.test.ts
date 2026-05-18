import { describe, it, expect } from "vitest"

import { computeStandings, sortStandings } from "./standings"
import type { Match, Player } from "./types"

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
    id: crypto.randomUUID(),
    round: 0,
    court: 1,
    teamA: { playerA: ta[0], playerB: ta[1] },
    teamB: { playerA: tb[0], playerB: tb[1] },
    gamesA: ga,
    gamesB: gb,
  }
}

describe("computeStandings", () => {
  it("accumulates games won, lost, diff, points correctly", () => {
    const matches = [
      match(["A", "B"], ["C", "D"], 6, 2),
      match(["A", "C"], ["B", "D"], 3, 3),
      match(["A", "D"], ["B", "C"], 6, 0),
    ]
    const standings = computeStandings(players, matches)
    const a = standings.find((s) => s.player.id === "A")!
    expect(a.matchesPlayed).toBe(3)
    expect(a.gamesWon).toBe(6 + 3 + 6)
    expect(a.gamesLost).toBe(2 + 3 + 0)
    expect(a.gamesDiff).toBe(4 + 0 + 6)
    expect(a.matchesWon).toBe(2) // 2 wins, 1 tie
    expect(a.points).toBe(3 + 1 + 3) // win + tie + win
  })

  it("ties give both teams 1 point each", () => {
    const matches = [match(["A", "B"], ["C", "D"], 4, 4)]
    const standings = computeStandings(players, matches)
    for (const s of standings) {
      expect(s.points).toBe(1)
      expect(s.matchesWon).toBe(0)
      expect(s.gamesDiff).toBe(0)
    }
  })

  it("ignores matches without recorded results", () => {
    const m = match(["A", "B"], ["C", "D"], 6, 2)
    m.gamesA = null
    m.gamesB = null
    const standings = computeStandings(players, [m])
    for (const s of standings) {
      expect(s.matchesPlayed).toBe(0)
      expect(s.points).toBe(0)
    }
  })
})

describe("sortStandings", () => {
  it("by points: orders by points → gamesDiff → gamesWon", () => {
    const matches = [
      match(["A", "B"], ["C", "D"], 6, 0), // A,B win big
      match(["A", "C"], ["B", "D"], 6, 4), // A,C win narrowly
      match(["A", "D"], ["B", "C"], 6, 5), // A,D win narrowly
    ]
    const standings = computeStandings(players, matches)
    const byPoints = sortStandings(standings, "points")
    // A has 3 wins = 9 pts (most)
    expect(byPoints[0].player.id).toBe("A")
    expect(byPoints[0].points).toBe(9)
  })

  it("by games: orders by gamesWon (regardless of wins)", () => {
    const matches = [
      // Team A,B blows out C,D (6-0): high games for A,B
      match(["A", "B"], ["C", "D"], 6, 0),
      // Team B,C blows out A,D (6-0): high games for B,C
      match(["B", "C"], ["A", "D"], 6, 0),
      // Team A,C wins close (6-5): A and C get +6, B and D get +5
      match(["A", "C"], ["B", "D"], 6, 5),
    ]
    const standings = computeStandings(players, matches)
    const byGames = sortStandings(standings, "games")
    // B has highest games won
    // A: 6 + 0 + 6 = 12, B: 6 + 6 + 5 = 17, C: 0 + 6 + 6 = 12, D: 0 + 0 + 5 = 5
    expect(byGames[0].player.id).toBe("B")
    expect(byGames[0].gamesWon).toBe(17)
    expect(byGames[3].player.id).toBe("D")
    expect(byGames[3].gamesWon).toBe(5)
  })

  it("by games and by points produce different orderings when relevant", () => {
    // Player who wins many close games has high points but low games
    // Player who wins fewer blowouts has fewer points but more games
    const matches = [
      // Round 1: A,B beat C,D 6-5 (close)
      match(["A", "B"], ["C", "D"], 6, 5),
      // Round 2: A,B beat C,D 6-5 (close)
      match(["A", "B"], ["C", "D"], 6, 5),
      // Round 3: C,D beat A,B 6-0 (blowout for C,D)
      match(["C", "D"], ["A", "B"], 6, 0),
    ]
    const standings = computeStandings(players, matches)
    const byPoints = sortStandings(standings, "points")
    const byGames = sortStandings(standings, "games")
    // A,B have 6 pts each (2 wins), C,D have 3 pts each (1 win)
    // A,B have 12 games each, C,D have 16 games each
    expect(byPoints[0].player.id).toMatch(/A|B/)
    expect(byPoints[0].points).toBe(6)
    expect(byGames[0].player.id).toMatch(/C|D/)
    expect(byGames[0].gamesWon).toBe(16)
  })

  it("sort is stable when values are equal (uses name)", () => {
    const matches = [match(["A", "B"], ["C", "D"], 3, 3)]
    const standings = computeStandings(players, matches)
    const sorted = sortStandings(standings, "games")
    // All players have same games (3) and same points (1)
    // Should fall back to alphabetical: Ana, Bruno, Carla, Diego
    expect(sorted.map((s) => s.player.name)).toEqual(["Ana", "Bruno", "Carla", "Diego"])
  })

  it("computeStandings preserves insertion order; sortStandings is pure", () => {
    const matches = [match(["A", "B"], ["C", "D"], 6, 0)]
    const standings = computeStandings(players, matches)
    const order1 = standings.map((s) => s.player.id)
    sortStandings(standings, "points")
    const order2 = standings.map((s) => s.player.id)
    // sortStandings returns a new array; original is unchanged
    expect(order1).toEqual(order2)
  })
})
