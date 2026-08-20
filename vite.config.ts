import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Build stamp, resolved from git at build time and frozen into the bundle.
 *
 * The build number is `git rev-list --count HEAD` — it increments on its own
 * with every commit, so there's nothing to remember to bump, and unlike a
 * bare commit hash you can tell at a glance which of two builds is newer.
 */
function git(args: string, fallback: string): string {
  try {
    return execSync(`git ${args}`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    // Shallow clone, no git, or a tarball build — a stamp is never worth
    // failing a build over.
    return fallback
  }
}

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string
}
// Uncommitted changes mean the stamp doesn't identify a real commit; say so
// rather than pointing at a tree that isn't what's running.
const dirty = git("status --porcelain", "") !== ""

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(git("rev-list --count HEAD", "0")),
    __APP_COMMIT__: JSON.stringify(
      git("rev-parse --short HEAD", "unknown") + (dirty ? "-dirty" : ""),
    ),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
})
