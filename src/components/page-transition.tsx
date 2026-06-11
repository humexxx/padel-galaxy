import type { ReactNode } from "react"

/**
 * Mount-time fade/slide-in for route content. CSS-only (tw-animate-css) on
 * purpose: this sits in the eager AppLayout chunk, and importing
 * framer-motion here used to drag ~30 KB gz into the critical path of every
 * authenticated page. AppLayout keys this by pathname so the animation
 * replays on navigation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out">
      {children}
    </div>
  )
}
