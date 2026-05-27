import * as React from "react"

/**
 * Scrolls a trigger element into view when an associated popover/dialog
 * opens — but only on narrow screens. Used by the comboboxes (player,
 * group, group multi-select) so that when the soft keyboard appears on
 * mobile, the input doesn't get hidden behind it.
 *
 * Usage:
 *   const triggerRef = React.useRef<HTMLButtonElement>(null)
 *   useScrollOnOpen(triggerRef, open)
 *   // …
 *   <PopoverTrigger ref={triggerRef} className="scroll-mt-16">
 *
 * `scroll-mt-16` (or similar) on the trigger lets the browser leave
 * room for the sticky site header when it scrolls into view — without
 * it the trigger lands at y=0 underneath the header.
 *
 * Narrow-screen detection uses `matchMedia` against the same breakpoint
 * Tailwind calls `sm` (640 px). Tablets in landscape don't trigger this
 * because the soft keyboard isn't a problem there either.
 */
export function useScrollOnOpen(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
): void {
  React.useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return
    // `(max-width: 639px)` matches everything below Tailwind's `sm`
    // breakpoint (which is `min-width: 640px`). SSR-safe via window
    // check, though this codebase is Vite + CSR — defensive anyway.
    if (typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 639px)").matches) return
    // rAF gives the popover one frame to start its open animation before
    // we move the trigger — without it some browsers cancel the scroll
    // because the layout is still settling.
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "smooth" })
    })
    return () => cancelAnimationFrame(id)
  }, [open, ref])
}
