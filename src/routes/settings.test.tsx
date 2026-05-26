// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"

import type { UserProfile } from "@/lib/user-profile"

// ---------- Mocks ----------

const mockUser = {
  uid: "owner-1",
  displayName: "Owner",
  email: "owner@example.com",
  reload: vi.fn(async () => undefined),
}

const mockSignOut = vi.fn(async () => undefined)
const mockNavigate = vi.fn()

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
    isSuperAdmin: false,
    role: "player",
    loading: false,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: mockSignOut,
    refreshClaims: vi.fn(),
  }),
}))

const profile: UserProfile = {
  uid: "owner-1",
  email: "owner@example.com",
  displayName: "Owner",
  preferredSide: "any",
  role: "player",
  createdAt: 0,
  updatedAt: 0,
}

vi.mock("@/hooks/use-user-profile", () => ({
  useUserProfile: () => ({ profile, hydrated: true }),
}))

// vi.mock factories are hoisted above ordinary variables, so any mock we
// want to reference INSIDE a factory has to be declared via vi.hoisted.
// That gives us back the test handles (mockClear, toHaveBeenCalledWith) at
// runtime without TDZ errors during module init.
const {
  saveUserProfileMock,
  deleteUserProfileMock,
  updateProfileMock,
  deleteUserAuthMock,
} = vi.hoisted(() => ({
  saveUserProfileMock: vi.fn<
    (input: {
      uid: string
      displayName?: string
      preferredSide?: string
    }) => Promise<void>
  >(async () => undefined),
  deleteUserProfileMock: vi.fn<(uid: string) => Promise<void>>(
    async () => undefined,
  ),
  updateProfileMock: vi.fn<(...args: unknown[]) => Promise<void>>(
    async () => undefined,
  ),
  deleteUserAuthMock: vi.fn<(...args: unknown[]) => Promise<void>>(
    async () => undefined,
  ),
}))

vi.mock("@/lib/user-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/user-profile")>()
  return {
    ...actual,
    saveUserProfile: saveUserProfileMock,
    deleteUserProfile: deleteUserProfileMock,
  }
})

// firebase/auth: stub the two functions Settings imports so we don't need
// a real auth instance. updateProfile + deleteUser are the only ones used.
vi.mock("firebase/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/auth")>()
  return {
    ...actual,
    updateProfile: updateProfileMock,
    deleteUser: deleteUserAuthMock,
  }
})

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
}))

// Import AFTER the mocks so the page picks up the stubs.
// eslint-disable-next-line import/first
import { SettingsPage } from "./settings"

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  saveUserProfileMock.mockClear()
  deleteUserProfileMock.mockClear()
  updateProfileMock.mockClear()
  deleteUserAuthMock.mockClear()
  mockSignOut.mockClear()
  mockNavigate.mockReset()
})

// ---------- Tests ----------

describe("<SettingsPage />", () => {
  it("renders the Perfil section by default", () => {
    renderPage()
    expect(screen.getByText(/Cómo te van a ver el resto de los jugadores/i)).toBeVisible()
    // The displayName input is filled from the profile.
    const nameInput = screen.getByLabelText(/^Nombre$/i) as HTMLInputElement
    expect(nameInput.value).toBe("Owner")
  })

  it("save button stays hidden while no field is dirty", () => {
    renderPage()
    expect(screen.queryByRole("button", { name: /Guardar cambios/i })).toBeNull()
  })

  it("editing the displayName surfaces the sticky save button and persists on click", async () => {
    const user = userEvent.setup()
    renderPage()
    const nameInput = screen.getByLabelText(/^Nombre$/i)
    await user.clear(nameInput)
    await user.type(nameInput, "New Name")

    const saveButton = screen.getByRole("button", { name: /Guardar cambios/i })
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)

    await waitFor(() => expect(saveUserProfileMock).toHaveBeenCalledTimes(1))
    expect(saveUserProfileMock).toHaveBeenCalledWith({
      uid: "owner-1",
      displayName: "New Name",
      preferredSide: "any",
    })
    // displayName changed → updateProfile is called too so Firebase Auth
    // stays in sync.
    expect(updateProfileMock).toHaveBeenCalled()
  })

  it("switches between sections via the side nav", async () => {
    const user = userEvent.setup()
    renderPage()

    // Default: Perfil.
    expect(screen.getByLabelText(/^Nombre$/i)).toBeVisible()

    // Click Preferencias.
    await user.click(screen.getByRole("button", { name: /^Preferencias$/i }))
    expect(screen.getByText(/Lado preferido/i)).toBeVisible()
    // Three side cards rendered (any / reves / drive).
    expect(screen.getByText(/Cualquiera/i)).toBeVisible()
    expect(screen.getByText(/Drive \(derecha\)/i)).toBeVisible()
    expect(screen.getByText(/Revés \(izquierda\)/i)).toBeVisible()

    // Click Privacidad. CardTitle renders as a div (not a heading element),
    // so we assert by text instead of by role.
    await user.click(screen.getByRole("button", { name: /^Privacidad$/i }))
    expect(screen.getByText(/Zona de peligro/i)).toBeVisible()
  })

  it("changing the preferred side flips the dirty flag and saves with the new value", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /^Preferencias$/i }))

    // Pick "Drive (derecha)". Whole card is the label-as-click-target.
    await user.click(screen.getByText(/Drive \(derecha\)/i))

    const saveButton = screen.getByRole("button", { name: /Guardar cambios/i })
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)

    await waitFor(() => expect(saveUserProfileMock).toHaveBeenCalledTimes(1))
    expect(saveUserProfileMock).toHaveBeenCalledWith({
      uid: "owner-1",
      displayName: "Owner",
      preferredSide: "drive",
    })
    // displayName unchanged → updateProfile should NOT have been called.
    expect(updateProfileMock).not.toHaveBeenCalled()
  })

  it("Privacy: account deletion is gated on typing the email exactly", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: /^Privacidad$/i }))

    // Open the dialog.
    await user.click(screen.getByRole("button", { name: /^Eliminar cuenta$/i }))

    const confirmButton = await screen.findByRole("button", {
      name: /Eliminar definitivamente/i,
    })
    expect(confirmButton).toBeDisabled()

    // Wrong email → still disabled.
    const confirmInput = screen.getByPlaceholderText(/owner@example\.com/i)
    await user.type(confirmInput, "wrong@email.test")
    expect(confirmButton).toBeDisabled()

    // Right email → enabled.
    await user.clear(confirmInput)
    await user.type(confirmInput, "owner@example.com")
    expect(confirmButton).toBeEnabled()

    // Click confirm. Order matters: doc delete first, then auth delete.
    await user.click(confirmButton)

    await waitFor(() => expect(deleteUserProfileMock).toHaveBeenCalledTimes(1))
    expect(deleteUserAuthMock).toHaveBeenCalledTimes(1)
    // After successful delete, we sign out + navigate to /login.
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true })
  })
})
