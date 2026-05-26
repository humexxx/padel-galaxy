import * as React from "react"

const KEY_SHOOTING_STARS = "pg.shooting-stars-enabled"

const listeners = new Set<() => void>()

function readShootingStars(): boolean {
  if (typeof window === "undefined") return true
  // Default ON when the key is absent — preference is opt-out.
  return window.localStorage.getItem(KEY_SHOOTING_STARS) !== "0"
}

export function setShootingStarsEnabled(value: boolean): void {
  window.localStorage.setItem(KEY_SHOOTING_STARS, value ? "1" : "0")
  listeners.forEach((l) => l())
}

export function useShootingStarsEnabled(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    readShootingStars,
    () => true,
  )
}
