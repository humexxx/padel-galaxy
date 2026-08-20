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
 * Every state except `installed` and `hidden` must lead somewhere. Hiding the
 * entry point whenever we couldn't offer a one-tap install left users staring
 * at a menu with no install option and no explanation — the single most
 * common way this feature failed in practice.
 *
 * - `prompt`    — Chrome handed us an install event: one tap, done.
 * - `ios`       — iOS Safari never fires that event; walk them through
 *                 Share → "Agregar a inicio".
 * - `ios-other` — iOS, but Chrome/Firefox/Edge. iOS only lets Safari add to
 *                 the home screen, so the path is "reopen this in Safari".
 * - `manual`    — a Chromium browser that didn't give us an event. Usually
 *                 already installed, or the user dismissed the prompt once
 *                 and Chrome is suppressing it. Point at the browser menu.
 * - `installed` — already running from the home screen, nothing to offer.
 * - `hidden`    — genuinely nothing to say (e.g. desktop Firefox).
 */
export type InstallState =
  | "prompt"
  | "ios"
  | "ios-other"
  | "manual"
  | "installed"
  | "hidden"

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

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

/**
 * Chrome/Firefox/Edge on iOS wrap WebKit but cannot add to the home screen —
 * iOS reserves that for Safari — so they need different instructions, not the
 * Share-sheet ones.
 */
function isIOSSafari(): boolean {
  return isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
}

function snapshot(): InstallState {
  if (didInstall || isStandalone()) return "installed"
  if (deferredPrompt) return "prompt"
  if (isIOS()) return isIOSSafari() ? "ios" : "ios-other"
  // Chromium exposes the event type even when it has no event for us right
  // now — enough to know the browser CAN install, so we can point at its own
  // menu instead of going silent.
  if (typeof window !== "undefined" && "onbeforeinstallprompt" in window) {
    return "manual"
  }
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
