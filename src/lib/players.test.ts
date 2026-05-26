import { describe, it, expect } from "vitest"

import { findPlayerByName, normalizeName, type PlayerRecord } from "./players"

function makePlayer(name: string, overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    id: `p-${name}`,
    ownerId: "owner-1",
    name,
    nameLower: normalizeName(name),
    linkedUid: null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe("normalizeName", () => {
  it("lowercases", () => {
    expect(normalizeName("Jason")).toBe("jason")
    expect(normalizeName("JASON")).toBe("jason")
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeName("  Jason  ")).toBe("jason")
    expect(normalizeName("\tJason\n")).toBe("jason")
  })

  it("preserves internal whitespace", () => {
    // Two players named "Juan Pablo" and "Juan  Pablo" (double space) should
    // NOT collide — we only trim the ends, not collapse runs.
    expect(normalizeName("Juan Pablo")).toBe("juan pablo")
    expect(normalizeName("Juan  Pablo")).toBe("juan  pablo")
  })

  it("strips diacritics (tildes, umlauts, ñ tilde, etc.)", () => {
    expect(normalizeName("José")).toBe("jose")
    expect(normalizeName("María")).toBe("maria")
    expect(normalizeName("Iñaki")).toBe("inaki")
    expect(normalizeName("Müller")).toBe("muller")
  })

  it("handles empty / whitespace-only input as empty string", () => {
    expect(normalizeName("")).toBe("")
    expect(normalizeName("   ")).toBe("")
  })

  it("is idempotent", () => {
    const once = normalizeName("José Ramón")
    expect(normalizeName(once)).toBe(once)
  })
})

describe("findPlayerByName", () => {
  const roster: PlayerRecord[] = [
    makePlayer("Jason Hume"),
    makePlayer("José Ramón"),
    makePlayer("Ana"),
  ]

  it("matches by exact (already normalized) name", () => {
    expect(findPlayerByName(roster, "Jason Hume")?.id).toBe("p-Jason Hume")
  })

  it("matches case-insensitively", () => {
    expect(findPlayerByName(roster, "JASON HUME")?.id).toBe("p-Jason Hume")
    expect(findPlayerByName(roster, "jason hume")?.id).toBe("p-Jason Hume")
  })

  it("matches ignoring tildes both ways", () => {
    // Roster has tildes, user types without.
    expect(findPlayerByName(roster, "Jose Ramon")?.id).toBe("p-José Ramón")
    // User types with tildes, also matches.
    expect(findPlayerByName(roster, "JOSÉ RAMÓN")?.id).toBe("p-José Ramón")
  })

  it("ignores leading / trailing whitespace", () => {
    expect(findPlayerByName(roster, "   ana   ")?.id).toBe("p-Ana")
  })

  it("returns undefined for empty input (we don't match the first player)", () => {
    expect(findPlayerByName(roster, "")).toBeUndefined()
    expect(findPlayerByName(roster, "   ")).toBeUndefined()
  })

  it("returns undefined when there is no match", () => {
    expect(findPlayerByName(roster, "Carla")).toBeUndefined()
  })

  it("only returns exact normalized matches (no substring / fuzzy)", () => {
    // "Ana" should not match "Anabella" or "Ja" — findPlayerByName is for
    // deduplication on submit, not for search-as-you-type filtering.
    const extended: PlayerRecord[] = [
      ...roster,
      makePlayer("Anabella"),
      makePlayer("Janet"),
    ]
    expect(findPlayerByName(extended, "An")?.id).toBeUndefined()
    expect(findPlayerByName(extended, "Anab")?.id).toBeUndefined()
    expect(findPlayerByName(extended, "Anabella")?.id).toBe("p-Anabella")
  })

  it("returns the first match if duplicates exist (defensive)", () => {
    // In practice Firestore + the form prevent duplicates from being
    // created, but the function should still be deterministic.
    const dupes: PlayerRecord[] = [
      makePlayer("Ana", { id: "first" }),
      makePlayer("ana", { id: "second" }),
    ]
    expect(findPlayerByName(dupes, "Ana")?.id).toBe("first")
  })
})
