import { test, expect, type Page } from "@playwright/test"

import { E2E_USER } from "./global-setup"

const PLAYER_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Eli",
  "Fede",
  "Gus",
  "Hugo",
]

async function signIn(page: Page) {
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(E2E_USER.email)
  await page.getByLabel(/contraseña/i).fill(E2E_USER.password)
  await page.getByRole("button", { name: /^Ingresar$/i }).click()
  await page.waitForURL("**/pozos")
}

async function fillSlotByCreating(page: Page, slotIndex: number, name: string) {
  // Each combobox trigger has aria-label="Jugador N". Use locator() with the
  // CSS attribute selector instead of getByRole — Playwright's role-based
  // matcher crashes on the base-ui `<PopoverTrigger>` rendering chain with
  // "element.matches is not a function". The aria-label attribute is set
  // by PlayerCombobox so it's a stable hook either way.
  await page.locator(`button[aria-label="Jugador ${slotIndex + 1}"]`).click()
  // The popover renders a CommandInput placeholder. Scope to the visible
  // popover via .last() — base-ui keeps the previous popover's DOM around
  // briefly during the exit animation, so without the scope we'd race on
  // two CommandInputs (one fading out, one fresh).
  const input = page.getByPlaceholder(/buscar o crear/i).last()
  await input.waitFor({ state: "visible" })
  await input.fill(name)
  await page.getByRole("option", { name: new RegExp(`^Crear "${name}"`) }).click()
  // Wait for THIS popover to fully close before the loop iterates, so the
  // next slot doesn't race against the lingering DOM of this one.
  await input.waitFor({ state: "hidden" })
}

test.describe("Pozo creation flow", () => {
  test.beforeEach(async ({ context }) => {
    // Isolate each test run — clear cookies / localStorage so we don't
    // carry an authenticated session from a previous test.
    await context.clearCookies()
    await context.clearPermissions()
  })

  test("user can log in, create a pozo, and land on its detail page", async ({
    page,
  }) => {
    await signIn(page)

    // Dashboard renders the create card.
    await expect(
      page.getByRole("heading", { name: /^Pozos$/i, level: 1 }),
    ).toBeVisible()

    // Open the new-pozo form.
    await page.getByRole("link", { name: /Crear pozo/i }).first().click()
    await page.waitForURL("**/pozos/nuevo")

    // Pozo name — leave default. Fill all 8 slots with brand-new players.
    for (let i = 0; i < PLAYER_NAMES.length; i++) {
      await fillSlotByCreating(page, i, PLAYER_NAMES[i])
    }

    // Submit. The form should redirect to /pozos/<id>.
    const submit = page.getByRole("button", { name: /^Crear pozo$/i })
    await expect(submit).toBeEnabled()
    await submit.click()
    await page.waitForURL(/\/pozos\/[\w-]+$/)

    // The detail page shows the pozo title + player count.
    await expect(
      page.getByText(/8 jugadores/i).first(),
    ).toBeVisible()
  })

  test("after creating a pozo, the roster persists for the next pozo", async ({
    page,
  }) => {
    // This run leverages the players seeded by the previous test (since
    // we reuse the same Firestore emulator state across tests in the
    // same project run). We open the form and expect the combobox to
    // surface the previously-created players as suggestions.
    await signIn(page)
    await page.getByRole("link", { name: /Crear pozo/i }).first().click()
    await page.waitForURL("**/pozos/nuevo")

    // Open the first slot and search for "Ana" — should appear as an
    // existing roster suggestion (not a "Crear" affordance). Use a CSS
    // attribute selector instead of getByRole — same workaround as
    // `fillSlotByCreating` above (base-ui PopoverTrigger crashes
    // Playwright's role-matcher).
    await page.locator('button[aria-label="Jugador 1"]').click()
    const input = page.getByPlaceholder(/buscar o crear/i)
    await input.waitFor({ state: "visible" })
    await input.fill("Ana")

    // The existing-player row is visible, AND the "Crear" affordance is
    // hidden because the name matches an existing player.
    await expect(
      page.getByRole("option", { name: /^Ana/i }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole("option", { name: /^Crear "/i }),
    ).toHaveCount(0)
  })
})
