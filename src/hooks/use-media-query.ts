import * as React from "react"

/**
 * Reactive `window.matchMedia` subscription. Re-renders when the query
 * flips (resize, rotation). SSR/first-paint snapshot is `false` — this
 * codebase is CSR-only so the real value lands on the first client render.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", cb)
      return () => mql.removeEventListener("change", cb)
    },
    [query],
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Below Tailwind's `sm` breakpoint — phones, where soft keyboards eat the
 * viewport and anchored popovers make for cramped pickers. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)")
}
