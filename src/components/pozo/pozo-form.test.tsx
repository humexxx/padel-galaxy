// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"

import { normalizeName, type PlayerRecord } from "@/lib/players"
import type { Pozo } from "@/lib/pozo/types"

// ---------- Mocks ----------

const mockNavigate = vi.fn()
const mockUser = { uid: "owner-1", displayName: "Owner", email: "owner@example.com" }

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    isAdmin: false,
    loading: false,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    refreshClaims: vi.fn(),
  }),
}))

const ROSTER: PlayerRecord[] = [
  // Names below match what the form will see via usePlayers().
  {
    id: "id-ana",
    ownerId: "owner-1",
    name: "Ana",
    nameLower: normalizeName("Ana"),
    linkedUid: null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "id-bruno",
    ownerId: "owner-1",
    name: "Bruno",
    nameLower: normalizeName("Bruno"),
    linkedUid: null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "id-jose",
    ownerId: "owner-1",
    name: "José Ramón",
    nameLower: normalizeName("José Ramón"),
    linkedUid: null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: 0,
    updatedAt: 0,
  },
]

vi.mock("@/hooks/use-players", () => ({
  usePlayers: () => ({ players: ROSTER, hydrated: true }),
}))

const TEST_GROUP = {
  id: "group-test",
  ownerId: "owner-1",
  name: "Test",
  nameLower: "test",
  createdAt: 0,
  updatedAt: 0,
}
vi.mock("@/hooks/use-groups", () => ({
  useGroups: () => ({ groups: [TEST_GROUP], hydrated: true }),
}))

type CreateGroupInput = { id: string; ownerId: string; name: string }
const createGroupMock = vi.fn<(input: CreateGroupInput) => Promise<void>>(
  async () => undefined,
)
vi.mock("@/lib/groups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/groups")>()
  return {
    ...actual,
    createGroup: (input: CreateGroupInput) => createGroupMock(input),
  }
})

type CreatePlayerInput = { id: string; ownerId: string; name: string }
const createPlayerMock = vi.fn<(input: CreatePlayerInput) => Promise<void>>(
  async () => undefined,
)
vi.mock("@/lib/players", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/players")>()
  return {
    ...actual,
    createPlayer: (input: CreatePlayerInput) => createPlayerMock(input),
  }
})

const savePozoMock = vi.fn<(pozo: Pozo) => Promise<void>>(async () => undefined)
// Full mock of /lib/storage. We can't use `importOriginal` here because
// the real module imports the Firestore SDK which needs an initialized
// `db` — the test runs without one and the SDK throws `_freezeSettings`
// on import. The form indirectly pulls in `usePozos`, which in turn
// imports the whole storage surface (subscribe* + save/remove), so each
// needs an inert stub or it'll break at hook-effect time.
const noopUnsub = () => undefined
vi.mock("@/lib/storage", () => ({
  savePozo: (pozo: Pozo) => savePozoMock(pozo),
  removePozo: async () => undefined,
  subscribePozo: () => noopUnsub,
  subscribeUserPozos: () => noopUnsub,
  subscribeAllPozos: () => noopUnsub,
  subscribeParticipantPozos: () => noopUnsub,
}))

let generatedIdCounter = 0
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>()
  return {
    ...actual,
    // doc(collection(db, "players")).id → predictable, monotonically increasing
    doc: () => ({ id: `gen-${++generatedIdCounter}` }),
    collection: () => ({}),
  }
})

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
}))

// Import AFTER mocks are declared so the form picks up the stubs.
// eslint-disable-next-line import/first
import { PozoForm } from "./pozo-form"

// ---------- Helpers ----------

function renderForm() {
  return render(
    <MemoryRouter>
      <PozoForm />
    </MemoryRouter>,
  )
}

async function pickTestGroup(user: ReturnType<typeof userEvent.setup>) {
  // Required field — every test that hits submit (or that asserts submit
  // is gated on something OTHER than the group) must pick a group first.
  await user.click(screen.getByRole("button", { name: /Grupo del pozo/i }))
  const listbox = await screen.findByRole("listbox")
  await user.click(within(listbox).getByText("Test"))
}

function getSlotTrigger(index: number): HTMLElement {
  // The combobox trigger for slot N has aria-label "Jugador N".
  return screen.getByRole("button", { name: `Jugador ${index + 1}` })
}

async function pickExistingForSlot(
  user: ReturnType<typeof userEvent.setup>,
  slotIndex: number,
  optionText: string,
) {
  await user.click(getSlotTrigger(slotIndex))
  const listbox = await screen.findByRole("listbox")
  await user.click(within(listbox).getByText(optionText))
}

async function typeNewForSlot(
  user: ReturnType<typeof userEvent.setup>,
  slotIndex: number,
  name: string,
  /** Strategy: match the "Crear «X»" row, or click the auto-matched existing row. */
  mode: "create" | "match",
) {
  await user.click(getSlotTrigger(slotIndex))
  const input = screen.getByPlaceholderText(/buscar/i)
  await user.type(input, name)
  if (mode === "create") {
    // Match the popover row exactly: it renders `Crear "name"` with quotes.
    // Avoid colliding with the form's "Crear pozo" submit button.
    await user.click(
      await screen.findByText(new RegExp(`^Crear "${name.trim()}"`, "i")),
    )
  } else {
    // Pick whichever existing row remains after filtering.
    const listbox = await screen.findByRole("listbox")
    const options = within(listbox).getAllByRole("option")
    await user.click(options[0])
  }
}

beforeEach(() => {
  mockNavigate.mockReset()
  createPlayerMock.mockReset()
  savePozoMock.mockReset()
  generatedIdCounter = 0
})

// ---------- Tests ----------

describe("<PozoForm /> submit flow", () => {
  it("resolves slots: existing-pick, dedup-by-name, and creates new players", async () => {
    const user = userEvent.setup()
    renderForm()
    await pickTestGroup(user)

    // Slots 0-1: pick existing from the roster directly.
    await pickExistingForSlot(user, 0, "Ana")
    await pickExistingForSlot(user, 1, "Bruno")

    // Slot 2: type a name that case/tilde-insensitively matches an existing
    // player ("jose ramon" → "José Ramón"). The combobox auto-detects the
    // match and HIDES the "Crear" affordance — the user picks the existing.
    await typeNewForSlot(user, 2, "jose ramon", "match")

    // Slots 3-7: five brand-new players.
    await typeNewForSlot(user, 3, "Carla", "create")
    await typeNewForSlot(user, 4, "Diego", "create")
    await typeNewForSlot(user, 5, "Eli", "create")
    await typeNewForSlot(user, 6, "Fede", "create")
    await typeNewForSlot(user, 7, "Gus", "create")

    // Submit.
    await user.click(screen.getByRole("button", { name: /Crear pozo/i }))

    // 5 truly-new players → createPlayer called exactly 5 times.
    await vi.waitFor(() => expect(savePozoMock).toHaveBeenCalledTimes(1))
    expect(createPlayerMock).toHaveBeenCalledTimes(5)

    // Each createPlayer call has the right ownerId and a fresh generated id.
    const newNames = createPlayerMock.mock.calls.map((c) => c[0].name)
    expect(newNames.sort()).toEqual(["Carla", "Diego", "Eli", "Fede", "Gus"])
    for (const [input] of createPlayerMock.mock.calls) {
      expect(input.ownerId).toBe("owner-1")
      expect(input.id).toMatch(/^gen-\d+$/)
    }

    // savePozo receives a pozo with all 8 players using REAL ids:
    //   3 from the existing roster + 5 freshly generated.
    const pozo = savePozoMock.mock.calls[0]?.[0]
    if (!pozo) throw new Error("savePozo wasn't called")
    expect(pozo.players).toHaveLength(8)
    expect(pozo.ownerId).toBe("owner-1")

    const ids = pozo.players.map((p) => p.id)
    expect(ids).toContain("id-ana")
    expect(ids).toContain("id-bruno")
    expect(ids).toContain("id-jose")
    const newIds = ids.filter((id) => id.startsWith("gen-"))
    expect(newIds).toHaveLength(5)
    // All ids are unique — no slot got the same id as another.
    expect(new Set(ids).size).toBe(8)

    // After save, navigate to the new pozo's detail page.
    expect(mockNavigate).toHaveBeenCalledWith(`/pozos/${pozo.id}`)
  })

  it("disables submit when fewer than MIN_PLAYERS slots are filled", async () => {
    const user = userEvent.setup()
    renderForm()
    await pickTestGroup(user)

    // Fill only 7 of the 8 slots.
    for (let i = 0; i < 7; i++) {
      await typeNewForSlot(user, i, `New${i}`, "create")
    }

    const submit = screen.getByRole("button", { name: /Crear pozo/i })
    expect(submit).toBeDisabled()
  })

  it("blocks submit on duplicate names (normalized comparison)", async () => {
    const user = userEvent.setup()
    renderForm()
    await pickTestGroup(user)

    // Pick Ana for slot 0, then in another slot type "ANA" (different casing
    // but same normalized name). The form's own validation should refuse to
    // submit and call savePozo zero times.
    await pickExistingForSlot(user, 0, "Ana")
    // For slot 1, type "ana" — the combobox would actually MATCH her and
    // pick her, but excludeIds already hides her. Simulate the case where
    // the user typed the same name in a different slot by clicking "Crear".
    //
    // The combobox hides Ana from slot 1's suggestions (excludeIds), so the
    // typed name "ana" produces a "Crear" row (no match in remaining list).
    await typeNewForSlot(user, 1, "ana", "create")
    for (let i = 2; i < 8; i++) {
      await typeNewForSlot(user, i, `New${i}`, "create")
    }

    const submit = screen.getByRole("button", { name: /Crear pozo/i })
    expect(submit).toBeDisabled()
    expect(
      screen.getByText(/Hay nombres de jugadores repetidos/i),
    ).toBeInTheDocument()
    expect(savePozoMock).not.toHaveBeenCalled()
  })
})
