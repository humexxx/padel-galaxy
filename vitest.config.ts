import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Default to Node for the pure-logic suites (fast). Files that need DOM
    // opt in via `// @vitest-environment jsdom` at the top.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Rules tests need a Firestore emulator (Java). Exclude from the default
    // suite — run them with `npm run test:rules`.
    exclude: ["tests/rules/**", "e2e/**", "node_modules/**", "dist/**"],
    setupFiles: ["src/test/setup.ts"],
  },
})
