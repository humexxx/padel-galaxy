import { test, expect, type Page } from "@playwright/test"

import { E2E_LINKED_PLAYER_ID, E2E_USERS } from "./global-setup"

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
    // Header shows Pozos but NOT Admin (superadmin-only) and NOT
    // Jugadores (admin-only — clientes get "Mi perfil" instead).
    await expect(page.getByRole("link", { name: /^Pozos$/ })).toBeVisible()
    await expect(page.getByRole("link", { name: /^Admin$/ })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /^Jugadores$/ })).toHaveCount(0)
  })

  test("the cliente sees 'Mi perfil' deep-linking to their own player detail", async ({
    page,
  }) => {
    await signInAs(page, PLAYER.email, PLAYER.password)
    const profileLink = page.getByRole("link", { name: /^Mi perfil$/ })
    await expect(profileLink).toBeVisible()
    await profileLink.click()
    // The link resolves to /jugadores/<linkedPlayer.id> — the seed makes
    // sure that record exists and is linked to the player user.
    await page.waitForURL(`**/jugadores/${E2E_LINKED_PLAYER_ID}`)
    // The detail page renders the player's display name as the headline.
    await expect(
      page.getByRole("heading", { name: PLAYER.displayName }),
    ).toBeVisible()
  })

  test("/jugadores roster is gated as admin-only — cliente sees the restricted screen", async ({
    page,
  }) => {
    // Going directly to the LIST page should be rejected for non-admins.
    // The detail (/jugadores/:id) stays accessible — that's what 'Mi perfil'
    // links to and what the rules permission for linked clientes.
    await signInAs(page, PLAYER.email, PLAYER.password)
    await page.goto("/jugadores")
    await expect(
      page.getByRole("heading", { name: /Acceso restringido/i }),
    ).toBeVisible()
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
