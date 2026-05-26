import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// Unmount any React tree rendered by a previous test so they don't bleed
// into each other. Cheap to run for Node-only tests too (no-op if nothing
// was rendered).
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement these. cmdk / radix scroll-into-view kbd nav
// blows up without them.
if (typeof window !== "undefined") {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined
  }
  if (typeof window.ResizeObserver === "undefined") {
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO
  }
  if (typeof window.matchMedia === "undefined") {
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
      writable: true,
    })
  }
}
