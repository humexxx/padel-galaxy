import * as React from "react"

/**
 * PWA install plumbing. Two moving parts that both have to be wired up
 * before React renders:
 *
 *   - the service worker, which Chrome requires before it will offer to
 *     install the app at all;
 *   - `beforeinstallprompt`, which Chrome fires exactly once and very early.
 *     Miss it and there is no second chance, so the listener is installed
 *     from `main.tsx` and the event is parked at module scope for whatever
 *     component mounts later.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * - `prompt`   — Chrome handed us an install event, show a button.
 * - `ios`      — iOS Safari never fires that event; installing is a manual
 *                Share → "Agregar a inicio", so we show instructions instead.
 * - `installed`— already running from the home screen, nothing to offer.
 * - `hidden`   — browser can't install (iOS Chrome/Firefox, older desktops).
 */
export type InstallState = "prompt" | "ios" | "installed" | "hidden"

let deferredPrompt: BeforeInstallPromptEvent | null = null
let didInstall = false
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates display-mode and exposes its own flag.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (!isIOS) return false
  // Chrome/Firefox/Edge on iOS wrap WebKit but cannot add to the home
  // screen, so pointing their users at the Share sheet would be a lie.
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

function snapshot(): InstallState {
  if (didInstall || isStandalone()) return "installed"
  if (deferredPrompt) return "prompt"
  if (isIOSSafari()) return "ios"
  return "hidden"
}

export function initPwa(): void {
  if (typeof window === "undefined") return

  window.addEventListener("beforeinstallprompt", (e) => {
    // Suppress Chrome's own mini-infobar so the in-app button is the single
    // entry point — otherwise the event is consumed and never re-fired.
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    emit()
  })

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    didInstall = true
    emit()
  })

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    // Registering after `load` keeps the worker off the critical path.
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration only costs offline support and the install
        // prompt — never block the app over it.
      })
    })
  }
}

/** Returns true when the user accepted. Safe to call in any state. */
export async function promptInstall(): Promise<boolean> {
  const evt = deferredPrompt
  if (!evt) return false
  // The event is single-use: clear it up front so a double click can't
  // call prompt() twice (which throws).
  deferredPrompt = null
  emit()
  await evt.prompt()
  const { outcome } = await evt.userChoice
  return outcome === "accepted"
}

export function useInstallState(): InstallState {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    snapshot,
    () => "hidden" as const,
  )
}
