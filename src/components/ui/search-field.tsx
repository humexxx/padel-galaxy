import * as React from "react"
import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * The one search box for every list in the app: iOS's filled, borderless
 * field with the magnifier inside. 44 px tall on phones so it matches the
 * other controls, back to the compact size from `sm` up.
 */
export function SearchField({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative w-full", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        className="rounded-xl border-transparent bg-muted pl-9 shadow-none focus-visible:bg-background dark:bg-muted dark:focus-visible:bg-background"
        aria-label={props.placeholder?.replace(/…$/, "")}
        {...props}
      />
    </div>
  )
}
