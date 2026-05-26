import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.PORT ?? 5173)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`

/**
 * Playwright config for Padel Galaxy E2E.
 *
 * Run with: `npm run test:e2e`
 *
 * Prerequisites (one-time):
 *   1. `npx playwright install chromium`
 *   2. Java installed (for Firestore + Auth emulators).
 *   3. `firebase setup:emulators:firestore && firebase setup:emulators:auth`
 *
 * The `test:e2e` script wraps everything: starts the Firebase emulators,
 * seeds a fixture user, starts Vite pointed at the emulators, and runs the
 * spec. See package.json for the chain.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev -- --port=5173",
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          // Force the app to talk to the emulators (auth on 9099, firestore
          // on 8080). The seed script below populates the same projectId.
          VITE_USE_FIREBASE_EMULATORS: "1",
        },
      },
})
