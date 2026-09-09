import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

export type ConfirmAction = {
  label: string
  onSelect: () => void
  /** Red — the choice that deletes, revokes, or otherwise can't be undone. */
  destructive?: boolean
  disabled?: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  /** In reading order. The first one is the primary choice. */
  actions: ConfirmAction[]
  cancelLabel?: string
  /** Disables every button while the chosen action runs. */
  busy?: boolean
}

/**
 * A confirmation that fits the platform. On a phone it is an iOS action
 * sheet: the options rise from the bottom as one grouped card, red for
 * what destroys, and "Cancelar" stands apart in its own card so it can't
 * be hit by mistake. From `sm` up it is the centered dialog with the same
 * choices as stacked buttons.
 */
export function ResponsiveConfirm({
  open,
  onOpenChange,
  title,
  description,
  actions,
  cancelLabel = "Cancelar",
  busy,
}: Props) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-2 border-0 bg-transparent p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-none"
        >
          <div className="overflow-hidden rounded-2xl bg-popover">
            <SheetHeader className="items-center gap-1 border-b px-6 py-3 text-center">
              <SheetTitle className="text-[13px] font-semibold text-muted-foreground">
                {title}
              </SheetTitle>
              {description && (
                <SheetDescription className="text-[13px]">
                  {description}
                </SheetDescription>
              )}
            </SheetHeader>
            {actions.map((action, i) => (
              <Button
                key={action.label}
                variant="ghost"
                className={cn(
                  "h-14 w-full rounded-none text-[17px] font-normal",
                  i > 0 && "border-t",
                  action.destructive
                    ? "text-destructive hover:text-destructive"
                    : "text-primary hover:text-primary",
                )}
                disabled={busy || action.disabled}
                onClick={action.onSelect}
              >
                {action.label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            className="h-14 w-full rounded-2xl bg-popover text-[17px] font-semibold text-primary hover:text-primary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* Plain `flex-col`: the footer's default `flex-col-reverse` would
            flip the choices into the opposite of their reading order. */}
        <DialogFooter className="flex-col sm:flex-col sm:items-stretch">
          {actions.map((action, i) => (
            <Button
              key={action.label}
              variant={
                action.destructive ? "destructive" : i === 0 ? "default" : "outline"
              }
              disabled={busy || action.disabled}
              onClick={action.onSelect}
            >
              {action.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
