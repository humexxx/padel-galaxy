/**
 * Minimal service worker. Two jobs:
 *   1. Make the app installable (Chrome/Android require a registered worker
 *      with a fetch handler before they offer "Add to home screen").
 *   2. Keep the app shell reachable when the network drops, so a phone that
 *      loses signal courtside shows the UI instead of the browser's dino.
 *
 * Deliberately NOT a full offline app: every pozo lives in Firestore, so
 * cross-origin requests are passed straight through and never cached here —
 * Firestore has its own persistence layer and we must not shadow it.
 *
 * Bump CACHE_VERSION to evict everything on the next deploy.
 */
const CACHE_VERSION = "v1"
const SHELL_CACHE = `pg-shell-${CACHE_VERSION}`
const ASSET_CACHE = `pg-assets-${CACHE_VERSION}`
const SHELL_URL = "/index.html"
const STATIC_FILE = /\.(?:svg|png|jpe?g|webp|ico|woff2?)$/

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Firestore, Auth, Google Fonts — not ours to cache.
  if (url.origin !== self.location.origin) return

  // Navigations: network first so a fresh deploy is picked up immediately,
  // falling back to the cached shell only when the network is unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy))
          return response
        })
        .catch(() =>
          caches
            .match(SHELL_URL)
            .then((cached) => cached ?? Response.error()),
        ),
    )
    return
  }

  // Vite emits content-hashed filenames under /assets, so a hit is always
  // the exact build that asked for it — cache-first is safe and makes stale
  // lazy chunks survive a redeploy instead of 404ing mid-session.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  // Files copied verbatim from public/ (logo, icons, login backdrop) keep
  // their names across deploys, so cache-first would pin a stale copy
  // forever. Serve the cached one for speed, refresh it in the background.
  if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            if (response.ok) void cache.put(request, response.clone())
            return response
          })
          .catch(() => cached ?? Response.error())
        return cached ?? network
      }),
    )
  }
})
