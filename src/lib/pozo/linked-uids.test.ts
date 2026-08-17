import { describe, it, expect } from "vitest"

import { reconcileLinkedUids } from "./linked-uids"

function pozo(playerIds: string[], linkedUids?: string[]) {
  return {
    players: playerIds.map((id) => ({ id, name: id.toUpperCase() })),
    linkedUids,
  }
}

describe("reconcileLinkedUids", () => {
  it("adds the uid of a player who linked their account after the pozo was created", () => {
    const roster = new Map([
      ["p1", "uid-1"],
      ["p2", null],
    ])
    // The pozo was created when only p1 was linked.
    const next = reconcileLinkedUids(pozo(["p1", "p2"], ["uid-1"]), roster)
    expect(next).toBeNull()

    roster.set("p2", "uid-2")
    expect(reconcileLinkedUids(pozo(["p1", "p2"], ["uid-1"]), roster)).toEqual([
      "uid-1",
      "uid-2",
    ])
  })

  it("returns null when nothing changed, so callers skip the write", () => {
    const roster = new Map([["p1", "uid-1"]])
    expect(reconcileLinkedUids(pozo(["p1"], ["uid-1"]), roster)).toBeNull()
  })

  it("handles a pozo created before linkedUids existed", () => {
    const roster = new Map([["p1", "uid-1"]])
    expect(reconcileLinkedUids(pozo(["p1"], undefined), roster)).toEqual(["uid-1"])
  })

  it("never removes a uid that is no longer in the roster", () => {
    // p2 belongs to another organizer's roster, so this organizer can't see
    // it. Dropping uid-2 would revoke access based on a partial view.
    const roster = new Map([["p1", "uid-1"]])
    const next = reconcileLinkedUids(pozo(["p1", "p2"], ["uid-2"]), roster)
    expect(next).toEqual(["uid-2", "uid-1"])
  })

  it("ignores unlinked and empty-string uids", () => {
    const roster = new Map([
      ["p1", null],
      ["p2", ""],
      ["p3", undefined],
    ])
    expect(reconcileLinkedUids(pozo(["p1", "p2", "p3"], []), roster)).toBeNull()
  })

  it("dedupes when two player records point at the same account", () => {
    // Happens after a duplicate-player merge: both ids resolve to one uid.
    const roster = new Map([
      ["p1", "uid-1"],
      ["p2", "uid-1"],
    ])
    expect(reconcileLinkedUids(pozo(["p1", "p2"], []), roster)).toEqual(["uid-1"])
  })
})
