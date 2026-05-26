import { test, expect, type Page } from "@playwright/test"

import { E2E_USERS } from "./global-setup"

const PLAYER = E2E_USERS.player

async function signInAs(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/contraseña/i).fill(password)
  await page.getByRole("button", { name: /^Ingresar$/i }).click()
  await page.waitForURL("**/pozos")
}

test.describe("Player (role=player) flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test("the Admin nav link is hidden for non-superadmins", async ({ page }) => {
    await signInAs(page, PLAYER.email, PLAYER.password)
    // Header shows Pozos / Jugadores / Historial but NOT Admin.
    await expect(page.getByRole("link", { name: /^Pozos$/ })).toBeVisible()
    await expect(page.getByRole("link", { name: /^Admin$/ })).toHaveCount(0)
  })

  test("navigating directly to /admin shows the restricted-access screen", async ({
    page,
  }) => {
    await signInAs(page, PLAYER.email, PLAYER.password)
    // Bypass the header by going to /admin directly. The RequireSuperAdmin
    // guard renders an "Acceso restringido" panel instead of the admin page.
    await page.goto("/admin")
    await expect(
      page.getByRole("heading", { name: /Acceso restringido/i }),
    ).toBeVisible()
    // The body explicitly mentions "superadmin" so the user knows what's up.
    await expect(page.getByText(/solo para superadmin/i)).toBeVisible()
    // The headline stays "/admin" — guard renders in place, no redirect.
    expect(page.url()).toContain("/admin")
  })

  test("a player can open Settings and change their preferred side", async ({ page }) => {
    await signInAs(page, PLAYER.email, PLAYER.password)
    await page.goto("/settings")

    // Preferencias tab → pick Revés (izquierda).
    await page.getByRole("button", { name: /^Preferencias$/i }).click()
    await page.getByText(/Revés \(izquierda\)/i).click()

    const saveButton = page.getByRole("button", { name: /Guardar cambios/i })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()
    await expect(page.getByText(/Cambios guardados/i)).toBeVisible()
  })
})
