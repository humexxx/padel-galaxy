import { describe, it, expect, vi, beforeEach } from "vitest"

const setDoc = vi.fn().mockResolvedValue(undefined)

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({ id: "ref" })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  setDoc: (...args: unknown[]) => setDoc(...args),
  updateDoc: vi.fn(),
  where: vi.fn(),
}))

vi.mock("@/lib/firebase", () => ({ db: {} }))

import { savePozo } from "./storage"
import { createPozo, DEFAULT_CONFIG } from "./pozo/factory"
import type { Pozo } from "./pozo/types"

const PLAYERS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `P${i + 1}`,
}))

function makePozo(overrides: Partial<Pozo> = {}): Pozo {
  return {
    ...createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: DEFAULT_CONFIG,
      groupId: "g1",
    }),
    ...overrides,
  }
}

function writtenDoc(): Record<string, unknown> {
  return setDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>
}

beforeEach(() => {
  setDoc.mockClear()
})

describe("savePozo", () => {
  it("drops undefined fields — Firestore rejects them outright", async () => {
    // What `handleChangeGroup(undefined)` produces when an organizer clears
    // a pozo's group: `{ ...pozo, groupId: undefined }`.
    await savePozo(makePozo({ groupId: undefined }))
    const written = writtenDoc()
    expect("groupId" in written).toBe(false)
    expect(Object.values(written).every((v) => v !== undefined)).toBe(true)
  })

  it("writes the group through when the pozo has one", async () => {
    await savePozo(makePozo())
    expect(writtenDoc().groupId).toBe("g1")
  })

  it("leaves every other field intact", async () => {
    const pozo = makePozo({ groupId: undefined })
    await savePozo(pozo)
    const written = writtenDoc()
    expect(written.id).toBe(pozo.id)
    expect(written.ownerId).toBe("o")
    expect(written.players).toHaveLength(8)
    // Falsy-but-defined values must survive — a naive truthiness filter
    // would eat currentRound: 0 and the null timestamps.
    expect(written.currentRound).toBe(0)
    expect("startedAt" in written).toBe(true)
    expect(written.startedAt).toBeNull()
  })
})
