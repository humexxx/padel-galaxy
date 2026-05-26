import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Single shared page-level container. Every authenticated route uses
 * this so widths, gutters, and vertical rhythm stay consistent across
 * the app. Marketing/landing layouts are intentionally NOT using it.
 *
 * Defaults:
 * - `max-w-5xl` — comfortable for tables, charts, and 2-col forms.
 * - `space-y-6` — standard vertical gap between cards/sections.
 * - Responsive `px`/`py` — tighter on mobile, roomier on desktop.
 *
 * Override or extend via `className`; the merge happens through cn().
 */
export function PageContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10",
        className,
      )}
      {...props}
    />
  )
}
