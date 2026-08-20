/**
 * Build identity, frozen in at compile time by vite.config.ts.
 *
 * `build` is the git commit count, so it climbs by itself on every commit —
 * no manual version bump, and "is 48 newer than 47?" answers itself in a way
 * a commit hash never can.
 */
export const APP_BUILD = {
  version: __APP_VERSION__,
  build: __APP_BUILD__,
  commit: __APP_COMMIT__,
  builtAt: __APP_BUILT_AT__,
} as const

/** Compact form for the UI, e.g. `v0.1.0 · build 48`. */
export const versionLabel = `v${APP_BUILD.version} · build ${APP_BUILD.build}`

/** Long form for a tooltip: adds the commit and when it was built. */
export function versionDetail(): string {
  const built = new Date(APP_BUILD.builtAt)
  const when = Number.isNaN(built.getTime())
    ? APP_BUILD.builtAt
    : built.toLocaleString("es-AR")
  return `Commit ${APP_BUILD.commit} · compilado ${when}`
}

/**
 * Also parked on `window` so the running build can be read without signing
 * in — which is exactly what you want when checking whether a deploy
 * actually landed.
 */
export function exposeBuildStamp(): void {
  if (typeof window === "undefined") return
  ;(window as unknown as Record<string, unknown>).__PG_BUILD__ = APP_BUILD
}
