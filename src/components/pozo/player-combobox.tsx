import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, UserIcon } from "lucide-react"

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
import { findPlayerByName, normalizeName, type PlayerRecord } from "@/lib/players"

export type PlayerSelection = {
  /** Firestore player id if the user picked an existing record; null while
   *  the user is typing a fresh name that hasn't been persisted yet. */
  id: string | null
  /** The display name. Source of truth in the form state. */
  name: string
}

type Props = {
  value: PlayerSelection
  onChange: (next: PlayerSelection) => void
  /** All players belonging to the current owner. Used for suggestions. */
  players: PlayerRecord[]
  /** Player ids picked in OTHER slots of the same pozo — these are hidden
   *  from suggestions so the user can't pick the same person twice. */
  excludeIds?: ReadonlySet<string>
  placeholder?: string
  /** Optional aria-label, e.g. "Jugador 1". */
  label?: string
  disabled?: boolean
}

export function PlayerCombobox({
  value,
  onChange,
  players,
  excludeIds,
  placeholder = "Buscar o crear…",
  label,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  // Suggestions: hide the players already picked in other slots, but always
  // keep the currently-selected one visible (so the user can confirm it).
  const suggestions = React.useMemo(() => {
    const excluded = excludeIds ?? new Set<string>()
    return players.filter((p) => p.id === value.id || !excluded.has(p.id))
  }, [players, excludeIds, value.id])

  // Does the typed search exactly match an existing player by normalized name?
  // If yes, hide the "create" affordance — picking the existing one is right.
  const typedMatchesExisting = React.useMemo(() => {
    if (!search.trim()) return false
    return findPlayerByName(suggestions, search) !== undefined
  }, [suggestions, search])

  const showCreate = search.trim().length > 0 && !typedMatchesExisting

  function pickExisting(p: PlayerRecord) {
    onChange({ id: p.id, name: p.name })
    setSearch("")
    setOpen(false)
  }

  function createNew(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    // Defer the actual Firestore write to submit-time. Until then we carry
    // id=null + name=text so the form can render and validate the slot.
    onChange({ id: null, name: trimmed })
    setSearch("")
    setOpen(false)
  }

  const displayName = value.name.trim()
  const isExistingPlayer = Boolean(value.id)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
          "hover:bg-accent/40",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=open]:bg-accent/40",
        )}
        aria-label={label}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <UserIcon
            className={cn(
              "size-3.5 shrink-0",
              isExistingPlayer ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span
            className={cn(
              "truncate text-left",
              !displayName && "text-muted-foreground",
            )}
          >
            {displayName || placeholder}
          </span>
          {!isExistingPlayer && displayName && (
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              nuevo
            </span>
          )}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) p-0"
        align="start"
        sideOffset={4}
      >
        <Command
          // Disable cmdk's default filter — we filter ourselves so we control
          // how the "create new" row interacts with normalized search.
          shouldFilter={false}
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar o crear…"
            autoFocus
          />
          <CommandList>
            <FilteredList
              players={suggestions}
              search={search}
              selectedId={value.id}
              onPick={pickExisting}
            />
            {showCreate && (
              <>
                {suggestions.length > 0 && <CommandSeparator />}
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
            {!showCreate && suggestions.length === 0 && (
              <CommandEmpty>Escribí un nombre…</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function FilteredList({
  players,
  search,
  selectedId,
  onPick,
}: {
  players: PlayerRecord[]
  search: string
  selectedId: string | null
  onPick: (p: PlayerRecord) => void
}) {
  const filtered = React.useMemo(() => {
    const key = normalizeName(search)
    if (!key) return players.slice(0, 50)
    return players
      .filter((p) => p.nameLower.includes(key))
      .slice(0, 50)
  }, [players, search])

  if (filtered.length === 0) return null

  return (
    <CommandGroup heading="Tus jugadores">
      {filtered.map((p) => {
        const selected = selectedId === p.id
        return (
          <CommandItem
            key={p.id}
            value={p.id}
            keywords={[p.name, p.nameLower]}
            onSelect={() => onPick(p)}
          >
            <CheckIcon
              className={cn("size-4", selected ? "opacity-100" : "opacity-0")}
            />
            <span className="truncate">{p.name}</span>
            {p.linkedUid && (
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                vinculado
              </span>
            )}
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}
