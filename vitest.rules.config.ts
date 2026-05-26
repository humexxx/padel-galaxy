import { defineConfig } from "vitest/config"
import path from "node:path"

/**
 * Vitest config for Firestore rules tests.
 *
 * Run with: `npm run test:rules` (requires the Firestore emulator to be
 * reachable on 127.0.0.1:8080 — start it via `firebase emulators:start
 * --only firestore` in another shell, or via `firebase emulators:exec`).
 *
 * The emulator binary needs Java; install once with `firebase setup:emulators:firestore`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    // Rules tests share a real (out-of-process) emulator. Running them in
    // parallel would race on the global Firestore state.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
