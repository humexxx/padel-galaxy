import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  /** Optional pre-built trigger. Omit when the caller opens it imperatively. */
  trigger?: React.ReactElement<Record<string, unknown>>
  children: React.ReactNode
  /** Action buttons. Stacked full-width on phones, inline on desktop. */
  footer?: React.ReactNode
  className?: string
}

/**
 * A form container that adapts to the viewport: a centered dialog on
 * desktop, a bottom sheet on phones. The sheet is what makes multi-field
 * forms usable one-handed — it opens next to the thumb, the body scrolls
 * on its own so the header and the action buttons stay put, and the
 * footer clears the home indicator.
 *
 * The sibling of `ResponsiveCombo`, which does the same for comboboxes.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  footer,
  className,
}: Props) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger && <SheetTrigger render={trigger} />}
        <SheetContent
          side="bottom"
          className={cn(
            "max-h-[92dvh] gap-0 rounded-t-2xl p-0 data-[side=bottom]:h-auto",
            className,
          )}
        >
          <SheetHeader className="border-b px-4 py-3 pr-12">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/50 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className={cn("max-h-[88dvh] sm:max-w-lg", className)}>
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* Negative inset + matching padding so focus rings on the edge
            fields aren't clipped by the scroll container. */}
        <div className="-mx-1 max-h-[60dvh] overflow-y-auto px-1">
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
