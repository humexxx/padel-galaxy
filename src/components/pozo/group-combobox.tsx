import * as React from "react"
import { ChevronsUpDownIcon, FolderIcon, PlusIcon } from "lucide-react"

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
import { useScrollOnOpen } from "@/hooks/use-scroll-on-open"
import { cn } from "@/lib/utils"
import { findGroupByName, type GroupRecord } from "@/lib/groups"
import { normalizeName } from "@/lib/players"

export type GroupSelection = {
  /** Firestore group id if the user picked an existing record; null while
   *  the user is typing a fresh name not yet persisted. */
  id: string | null
  /** The display name. Source of truth in the form state. */
  name: string
}

type Props = {
  value: GroupSelection
  onChange: (next: GroupSelection) => void
  groups: GroupRecord[]
  /** Optional aria-label, e.g. "Grupo del pozo". */
  label?: string
  disabled?: boolean
  /** Visual hint that the field is required and currently empty. */
  invalid?: boolean
}

export function GroupCombobox({
  value,
  onChange,
  groups,
  label,
  disabled,
  invalid,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  // On mobile, scroll the trigger up when the popover opens so the
  // CommandInput stays visible above the soft keyboard.
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  useScrollOnOpen(triggerRef, open)

  const filtered = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return groups
    return groups.filter((g) => g.nameLower.includes(q))
  }, [groups, search])

  const searchNormalized = normalizeName(search)
  const exactMatch = searchNormalized
    ? groups.find((g) => g.nameLower === searchNormalized)
    : undefined
  const showCreate = search.trim().length > 0 && !exactMatch

  function pickExisting(g: GroupRecord) {
    onChange({ id: g.id, name: g.name })
    setSearch("")
    setOpen(false)
  }

  function createNew(rawName: string) {
    const name = rawName.trim()
    if (!name) return
    // Same-name dedup: if a group already exists with this normalized name,
    // pick it instead of creating a duplicate intent.
    const existing = findGroupByName(groups, name)
    if (existing) {
      pickExisting(existing)
      return
    }
    onChange({ id: null, name })
    setSearch("")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            ref={triggerRef}
            type="button"
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs transition-colors",
              // scroll-mt leaves room for the sticky site-header during
              // the mobile keyboard-avoidance scroll.
              "scroll-mt-16",
              "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
              invalid && "border-destructive ring-destructive/30",
            )}
          />
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "truncate text-left",
              !value.name && "text-muted-foreground",
            )}
          >
            {value.name || "Seleccioná o creá un grupo"}
          </span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar o crear…"
            autoFocus
          />
          <CommandList>
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={g.id}
                    onSelect={() => pickExisting(g)}
                  >
                    <FolderIcon className="size-4 text-muted-foreground" />
                    <span className="truncate">{g.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <>
                {filtered.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Nuevo">
                  <CommandItem
                    value={`__create__${search}`}
                    onSelect={() => createNew(search)}
                  >
                    <PlusIcon className="size-4" />
                    Crear &quot;{search.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
            {!showCreate && filtered.length === 0 && (
              <CommandEmpty>Escribí un nombre…</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
