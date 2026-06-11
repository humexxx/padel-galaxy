import { describe, it, expect } from "vitest"

import { isMergeBlocked, mergePlayerInPozo } from "./players-merge"
import type { PlayerRecord } from "./players"
import type { Pozo } from "./pozo/types"

function makePlayer(overrides: Partial<PlayerRecord>): PlayerRecord {
  return {
    id: "p1",
    ownerId: "owner",
    name: "Jugador",
    nameLower: "jugador",
    linkedUid: null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function makePozo(overrides: Partial<Pozo>): Pozo {
  return {
    id: "pozo1",
    ownerId: "owner",
    name: "Pozo",
    createdAt: 1,
    status: "finished",
    config: {
      courts: 2,
      matchesPerPlayer: 7,
      totalDurationMin: 90,
      warmupMin: 5,
      algorithm: "balanced",
      allowRepeatPairs: false,
    },
    players: [],
    matches: [],
    currentRound: 0,
    totalRounds: 1,
    startedAt: null,
    warmupEndsAt: null,
    endsAt: null,
    finishedAt: null,
    ...overrides,
  }
}

const source = makePlayer({ id: "dup", name: "Juan P", nameLower: "juan p" })
const target = makePlayer({ id: "canon", name: "Juan", nameLower: "juan" })

describe("mergePlayerInPozo", () => {
  it("returns null when the pozo doesn't reference the source", () => {
    const pozo = makePozo({ players: [{ id: "otro", name: "Otro" }] })
    expect(mergePlayerInPozo(pozo, source, target)).toBeNull()
  })

  it("re-points the roster entry and every match pairing", () => {
    const pozo = makePozo({
      players: [
        { id: "dup", name: "Juan P" },
        { id: "x", name: "X" },
      ],
      matches: [
        {
          id: "m1",
          round: 0,
          court: 0,
          teamA: { playerA: "dup", playerB: "x" },
          teamB: { playerA: "y", playerB: "z" },
          gamesA: 6,
          gamesB: 3,
        },
      ],
    })
    const merged = mergePlayerInPozo(pozo, source, target)
    expect(merged?.players).toEqual([
      { id: "canon", name: "Juan" },
      { id: "x", name: "X" },
    ])
    expect(merged?.matches[0].teamA).toEqual({ playerA: "canon", playerB: "x" })
    expect(merged?.matches[0].teamB).toEqual({ playerA: "y", playerB: "z" })
    expect(merged?.matches[0].gamesA).toBe(6)
  })

  it("dedupes the roster when source and target are both in the pozo", () => {
    const pozo = makePozo({
      players: [
        { id: "dup", name: "Juan P" },
        { id: "canon", name: "Juan" },
      ],
    })
    const merged = mergePlayerInPozo(pozo, source, target)
    expect(merged?.players).toEqual([{ id: "canon", name: "Juan" }])
  })

  it("rewrites linkedUids: drops the source uid, adds the merged uid", () => {
    const linkedSource = makePlayer({ id: "dup", linkedUid: "uid-dup" })
    const unlinkedTarget = makePlayer({ id: "canon", name: "Juan" })
    const pozo = makePozo({
      players: [{ id: "dup", name: "Juan P" }],
      linkedUids: ["uid-dup", "uid-otro"],
    })
    const merged = mergePlayerInPozo(pozo, linkedSource, unlinkedTarget)
    // Target has no uid → the merged record keeps the source's uid.
    expect(merged?.linkedUids?.sort()).toEqual(["uid-dup", "uid-otro"])

    const linkedTarget = makePlayer({ id: "canon", linkedUid: "uid-canon" })
    const merged2 = mergePlayerInPozo(pozo, linkedSource, linkedTarget)
    expect(merged2?.linkedUids?.sort()).toEqual(["uid-canon", "uid-otro"])
  })

  it("populates linkedUids on legacy pozos that lacked the field", () => {
    const linkedTarget = makePlayer({ id: "canon", linkedUid: "uid-canon" })
    const pozo = makePozo({ players: [{ id: "dup", name: "Juan P" }] })
    delete pozo.linkedUids
    const merged = mergePlayerInPozo(pozo, source, linkedTarget)
    expect(merged?.linkedUids).toEqual(["uid-canon"])
  })
})

describe("isMergeBlocked", () => {
  it("blocks only when both records are linked to DIFFERENT accounts", () => {
    const a = makePlayer({ id: "a", linkedUid: "u1" })
    const b = makePlayer({ id: "b", linkedUid: "u2" })
    const c = makePlayer({ id: "c", linkedUid: null })
    const a2 = makePlayer({ id: "a2", linkedUid: "u1" })
    expect(isMergeBlocked(a, b)).toBe(true)
    expect(isMergeBlocked(a, c)).toBe(false)
    expect(isMergeBlocked(c, b)).toBe(false)
    expect(isMergeBlocked(a, a2)).toBe(false)
  })
})
