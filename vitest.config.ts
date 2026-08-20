import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Mirrors the build stamp vite.config.ts injects. Without it, any test
  // that transitively imports @/lib/version dies on an undefined global —
  // and the failure would look like a bug in whatever component pulled it in.
  define: {
    __APP_VERSION__: JSON.stringify("0.0.0-test"),
    __APP_BUILD__: JSON.stringify("0"),
    __APP_COMMIT__: JSON.stringify("test"),
    __APP_BUILT_AT__: JSON.stringify("1970-01-01T00:00:00.000Z"),
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
