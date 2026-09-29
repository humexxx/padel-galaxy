const KEY = "pg.reloaded-for-stale-chunk"

/**
 * After a deploy, a tab left open still asks for the previous build's
 * lazy chunks, which no longer exist. One reload fetches the new build.
 * Guarded so a chunk that is genuinely broken can't loop forever: a second
 * failure within a minute of the last reload is left to the error screen.
 *
 * Returns whether a reload was started.
 */
export function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Storage blocked: reloading without a guard could loop, so don't.
    return false
  }
  window.location.reload()
  return true
}

/** The browser's wording for "a dynamic import could not be fetched". */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "")
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(
    message,
  )
}
