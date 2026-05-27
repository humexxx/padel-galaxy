import { test, expect, type Page } from "@playwright/test"

import { E2E_USERS } from "./global-setup"

const ADMIN = E2E_USERS.admin

async function signInAs(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/contraseña/i).fill(password)
  await page.getByRole("button", { name: /^Ingresar$/i }).click()
  await page.waitForURL("**/pozos")
}

test.describe("Admin (superadmin) flow", () => {
  test.beforeEach(async ({ context }) => {
    // Each test starts with a clean session so we always go through /login.
    await context.clearCookies()
    await context.clearPermissions()
  })

  test("admin sees the /admin link in the header and can open the panel", async ({ page }) => {
    await signInAs(page, ADMIN.email, ADMIN.password)

    // Site header should expose the Admin nav item — only superadmins see it.
    const adminLink = page.getByRole("link", { name: /^Admin$/ })
    await expect(adminLink).toBeVisible()
    await adminLink.click()
    await page.waitForURL("**/admin")

    // The page renders the canonical superadmin headline + the email of the
    // current user (so a user impersonating an admin would be obvious).
    // The email appears in TWO places — the headline subtitle and the user
    // menu — so we anchor to the headline text specifically.
    await expect(page.getByRole("heading", { name: /^Admin$/, level: 1 })).toBeVisible()
    await expect(
      page.getByText(/Ingresaste como superadmin/i),
    ).toBeVisible()
  })

  test("admin can edit their preferences in Settings and the save button shows up only when dirty", async ({
    page,
  }) => {
    await signInAs(page, ADMIN.email, ADMIN.password)

    // Open the user menu → Settings (validates the menu wiring along the way).
    await page.getByRole("button", { name: /Abrir menú de usuario/i }).click()
    await page.getByRole("menuitem", { name: /Configuración/i }).click()
    await page.waitForURL("**/settings")

    // Sticky save button stays hidden as long as nothing is dirty.
    const saveButton = page.getByRole("button", { name: /Guardar cambios/i })
    await expect(saveButton).toHaveCount(0)

    // Switch to the Preferencias section and pick "Drive (derecha)".
    await page.getByRole("button", { name: /^Preferencias$/i }).click()
    // The whole card is a Label that wraps an sr-only radio. We can click the
    // visible label text — it forwards the click to the input via htmlFor.
    await page.getByText(/Drive \(derecha\)/i).click()

    // Save button now visible + enabled.
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeEnabled()

    await saveButton.click()

    // Success toast confirms the write went through.
    await expect(page.getByText(/Cambios guardados/i)).toBeVisible()
    // After save, the form is no longer dirty so the button disappears again.
    await expect(saveButton).toHaveCount(0)
  })

  test("Privacy section gates account deletion behind typing the email", async ({
    page,
  }) => {
    await signInAs(page, ADMIN.email, ADMIN.password)
    await page.goto("/settings")

    await page.getByRole("button", { name: /^Privacidad$/i }).click()

    // The destructive panel shows up with a trigger button. CardTitle
    // renders as a div (not a heading element), so we assert via getByText
    // — same fix we applied to the unit test.
    await expect(page.getByText(/Zona de peligro/i)).toBeVisible()
    // There are two destructive buttons (trigger + dialog button), use the
    // trigger button specifically.
    await page.getByRole("button", { name: /^Eliminar cuenta$/i }).click()

    // Dialog confirm button is initially disabled (no email typed yet).
    const confirmButton = page.getByRole("button", {
      name: /Eliminar definitivamente/i,
    })
    await expect(confirmButton).toBeVisible()
    await expect(confirmButton).toBeDisabled()

    // Typing the wrong email leaves it disabled.
    const input = page.getByPlaceholder(ADMIN.email)
    await input.fill("not@right.test")
    await expect(confirmButton).toBeDisabled()

    // Typing the correct email enables the button — we DO NOT click it
    // (we don't want to destroy the seeded admin between specs).
    await input.fill(ADMIN.email)
    await expect(confirmButton).toBeEnabled()

    // Close the dialog by pressing Escape so subsequent tests get a clean view.
    await page.keyboard.press("Escape")
  })
})
