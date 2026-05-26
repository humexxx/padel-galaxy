import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, FolderIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { normalizeName } from "@/lib/players"
import type { GroupRecord } from "@/lib/groups"

type Props = {
  /** All groups the user can pick from. */
  groups: GroupRecord[]
  /** Currently selected group ids. Empty = "all" (no filter). */
  value: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  /** Shown on the trigger and as the empty-set semantic label. */
  placeholder?: string
  className?: string
}

/**
 * Multi-select autocomplete for groups. Empty selection is treated as
 * "all groups" — semantically a no-filter. Clicking a row toggles it; the
 * popover stays open so the user can pick several in one go. Selected
 * groups are also rendered as removable chips next to the trigger.
 */
export function GroupMultiSelect({
  groups,
  value,
  onChange,
  placeholder = "Todos los grupos",
  className,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selected = React.useMemo(
    () => groups.filter((g) => value.has(g.id)),
    [groups, value],
  )

  const filtered = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return groups
    return groups.filter((g) => g.nameLower.includes(q))
  }, [groups, search])

  function toggle(id: string) {
    const next = new Set(value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  function remove(id: string) {
    const next = new Set(value)
    next.delete(id)
    onChange(next)
  }

  function clear() {
    onChange(new Set())
    setOpen(false)
  }

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].name
        : `${selected.length} grupos`

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
            "hover:bg-accent/40",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring",
            "data-[state=open]:bg-accent/40",
          )}
        >
          <FolderIcon
            className={cn(
              "size-3.5 shrink-0",
              selected.length > 0 ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span
            className={cn(
              "max-w-[16ch] truncate",
              selected.length === 0 && "text-muted-foreground",
            )}
          >
            {triggerLabel}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar grupo…"
              autoFocus
            />
            <CommandList>
              {filtered.length === 0 ? (
                <CommandEmpty>Sin grupos que coincidan.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filtered.map((g) => {
                    const isSelected = value.has(g.id)
                    return (
                      <CommandItem
                        key={g.id}
                        value={g.id}
                        keywords={[g.name, g.nameLower]}
                        onSelect={() => toggle(g.id)}
                      >
                        <CheckIcon
                          className={cn(
                            "size-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{g.name}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
              {value.size > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="__clear__"
                      onSelect={clear}
                      className="justify-center text-muted-foreground"
                    >
                      Limpiar selección
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Inline chips for each selected group — one click on the X removes
          that single group without touching the rest. */}
      {selected.map((g) => (
        <Badge
          key={g.id}
          variant="secondary"
          className="gap-1 pl-2 pr-1 text-xs font-medium"
        >
          {g.name}
          <button
            type="button"
            onClick={() => remove(g.id)}
            aria-label={`Quitar ${g.name}`}
            className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
