// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

const patchPozo = vi.fn().mockResolvedValue(undefined)
const syncGroupParticipants = vi.fn().mockResolvedValue(undefined)
const useAuth = vi.fn()
const usePlayers = vi.fn()

vi.mock("@/lib/storage", () => ({ patchPozo: (...a: unknown[]) => patchPozo(...a) }))
vi.mock("@/lib/groups", () => ({
  syncGroupParticipants: (...a: unknown[]) => syncGroupParticipants(...a),
}))
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => useAuth() }))
vi.mock("@/hooks/use-players", () => ({ usePlayers: () => usePlayers() }))

import { useLinkedUidsSync } from "./use-linked-uids-sync"
import type { Pozo } from "@/lib/pozo/types"

function makePozo(over: Partial<Pozo> = {}): Pozo {
  return {
    id: "pozo-1",
    ownerId: "owner-uid",
    name: "T",
    createdAt: 1,
    status: "draft",
    config: {} as Pozo["config"],
    players: [
      { id: "p1", name: "Uno" },
      { id: "p2", name: "Dos" },
    ],
    linkedUids: ["uid-1"],
    matches: [],
    currentRound: 0,
    totalRounds: 1,
    startedAt: null,
    warmupEndsAt: null,
    endsAt: null,
    finishedAt: null,
    roundStartedAt: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: { uid: "owner-uid" }, isAdmin: true })
  usePlayers.mockReturnValue({
    hydrated: true,
    // p2 claimed their account after the pozo was created.
    players: [
      { id: "p1", linkedUid: "uid-1" },
      { id: "p2", linkedUid: "uid-2" },
    ],
  })
})

describe("useLinkedUidsSync", () => {
  it("patches a pozo whose player linked after creation", async () => {
    renderHook(() => useLinkedUidsSync([makePozo()]))
    await waitFor(() => expect(patchPozo).toHaveBeenCalledTimes(1))
    expect(patchPozo).toHaveBeenCalledWith("pozo-1", {
      linkedUids: ["uid-1", "uid-2"],
    })
  })

  it("mirrors the uids onto the pozo's group", async () => {
    renderHook(() => useLinkedUidsSync([makePozo({ groupId: "g1" })]))
    await waitFor(() =>
      expect(syncGroupParticipants).toHaveBeenCalledWith("g1", [
        "uid-1",
        "uid-2",
      ]),
    )
  })

  it("writes nothing when every player is already linked", async () => {
    renderHook(() =>
      useLinkedUidsSync([makePozo({ linkedUids: ["uid-1", "uid-2"] })]),
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(patchPozo).not.toHaveBeenCalled()
    expect(syncGroupParticipants).not.toHaveBeenCalled()
  })

  it("skips pozos the user cannot write — the rules would reject them", async () => {
    useAuth.mockReturnValue({ user: { uid: "cliente-uid" }, isAdmin: false })
    renderHook(() => useLinkedUidsSync([makePozo()]))
    await new Promise((r) => setTimeout(r, 20))
    expect(patchPozo).not.toHaveBeenCalled()
  })

  it("patches a non-owned pozo when the user is an admin", async () => {
    useAuth.mockReturnValue({ user: { uid: "other-admin" }, isAdmin: true })
    renderHook(() => useLinkedUidsSync([makePozo()]))
    await waitFor(() => expect(patchPozo).toHaveBeenCalledTimes(1))
  })

  it("does not re-write the same pozo when the snapshot re-renders", async () => {
    const pozos = [makePozo()]
    const { rerender } = renderHook(() => useLinkedUidsSync(pozos))
    await waitFor(() => expect(patchPozo).toHaveBeenCalledTimes(1))
    rerender()
    rerender()
    await new Promise((r) => setTimeout(r, 20))
    expect(patchPozo).toHaveBeenCalledTimes(1)
  })

  it("waits for the roster before deciding anything", async () => {
    usePlayers.mockReturnValue({ hydrated: false, players: [] })
    renderHook(() => useLinkedUidsSync([makePozo()]))
    await new Promise((r) => setTimeout(r, 20))
    expect(patchPozo).not.toHaveBeenCalled()
  })
})
