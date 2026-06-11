import * as React from "react"

/**
 * Local (per-device) boolean preferences persisted in localStorage and
 * shared across components via useSyncExternalStore. One factory call per
 * preference keeps the read/write/subscribe plumbing in one place.
 */
function createBoolPref(key: string, defaultValue: boolean) {
  const listeners = new Set<() => void>()

  function read(): boolean {
    if (typeof window === "undefined") return defaultValue
    const raw = window.localStorage.getItem(key)
    if (raw === null) return defaultValue
    return raw === "1"
  }

  function set(value: boolean): void {
    window.localStorage.setItem(key, value ? "1" : "0")
    listeners.forEach((l) => l())
  }

  function usePref(): boolean {
    return React.useSyncExternalStore(
      (cb) => {
        listeners.add(cb)
        return () => {
          listeners.delete(cb)
        }
      },
      read,
      () => defaultValue,
    )
  }

  return { read, set, usePref }
}

const shootingStars = createBoolPref("pg.shooting-stars-enabled", true)
export const setShootingStarsEnabled = shootingStars.set
export const useShootingStarsEnabled = shootingStars.usePref

/** Beep when the warmup or the current match clock hits zero. */
const timerAlarm = createBoolPref("pg.timer-alarm-enabled", true)
export const setTimerAlarmEnabled = timerAlarm.set
export const useTimerAlarmEnabled = timerAlarm.usePref
