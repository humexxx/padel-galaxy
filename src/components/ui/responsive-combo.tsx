import * as React from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Heading for the mobile bottom sheet (invisible on desktop). */
  title: string
  /**
   * Fully-formed trigger element (typically a `<button>` with its content).
   * Passed to base-ui's `render` prop so Popover/Sheet merge their
   * open/close handlers and aria attributes onto it.
   */
  trigger: React.ReactElement<Record<string, unknown>>
  /** The `<Command>` content, shared between both presentations. */
  children: React.ReactNode
  /** Extra classes for the desktop popover (e.g. a fixed width when the
   * trigger is too narrow to anchor to). Defaults to anchor width. */
  popoverClassName?: string
}

/**
 * Combobox container that adapts to the viewport: an anchored popover on
 * desktop, a bottom sheet on phones. The sheet fixes the mobile pain points
 * of anchored popovers — cramped width, the soft keyboard covering the
 * list, and iOS auto-zoom (the search input is bumped to 16 px inside the
 * sheet via the data-slot selectors below).
 */
export function ResponsiveCombo({
  open,
  onOpenChange,
  title,
  trigger,
  children,
  popoverClassName,
}: Props) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger render={trigger} />
        <SheetContent
          side="bottom"
          // h-[85dvh]! beats the side=bottom h-auto default; a tall fixed
          // height keeps the search input near the top of the screen so
          // the soft keyboard never covers it.
          className="h-[85dvh]! gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-sm">{title}</SheetTitle>
          </SheetHeader>
          <div
            className={
              "flex min-h-0 flex-1 flex-col " +
              // 16 px input font stops iOS Safari from zooming the page on
              // focus; the list drops its popover max-height and flexes to
              // fill the sheet instead.
              "[&_[data-slot=command-input-wrapper]]:p-2 " +
              "[&_[data-slot=command-input]]:text-base! " +
              "[&_[data-slot=command-list]]:max-h-none " +
              "[&_[data-slot=command-list]]:flex-1"
            }
          >
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        className={cn("w-(--anchor-width) p-0", popoverClassName)}
        align="start"
        sideOffset={4}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
