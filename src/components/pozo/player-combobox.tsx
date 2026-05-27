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
import { useScrollOnOpen } from "@/hooks/use-scroll-on-open"
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
  /** All players the current user is allowed to see. For admins this is
   *  the whole platform roster; for regular users, just their own. */
  players: PlayerRecord[]
  /** Player ids the user has invited into past pozos. When non-empty,
   *  the dropdown surfaces them in a "Recientes" section above the rest.
   *  Helpful for admins facing a long platform-wide roster who only
   *  routinely pick a handful of regulars. */
  recentIds?: ReadonlySet<string>
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
  recentIds,
  excludeIds,
  placeholder = "Buscar o crear…",
  label,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  // On mobile, scroll the trigger up when the popover opens so the
  // CommandInput stays visible above the soft keyboard.
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  useScrollOnOpen(triggerRef, open)

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
        ref={triggerRef}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
          // scroll-mt leaves room for the sticky site-header when the
          // mobile keyboard-avoidance scroll fires.
          "scroll-mt-16",
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
              recentIds={recentIds}
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
  recentIds,
  onPick,
}: {
  players: PlayerRecord[]
  search: string
  selectedId: string | null
  recentIds?: ReadonlySet<string>
  onPick: (p: PlayerRecord) => void
}) {
  // Filter by search (or take a slice of the full list) FIRST, then
  // partition into recent vs. other so the 50-item cap doesn't push
  // recents off the visible end of a long list. Each section then keeps
  // up to half the cap, leaving room for both — falls through to a
  // single "Jugadores" group when there are no recents at all (cliente
  // or fresh admin who's never created a pozo).
  const filtered = React.useMemo(() => {
    const key = normalizeName(search)
    return key
      ? players.filter((p) => p.nameLower.includes(key))
      : players
  }, [players, search])

  const { recent, other } = React.useMemo(() => {
    const r: PlayerRecord[] = []
    const o: PlayerRecord[] = []
    const set = recentIds
    for (const p of filtered) {
      if (set && set.has(p.id)) r.push(p)
      else o.push(p)
    }
    // Cap each section at 50 to keep the menu height reasonable. Recents
    // are typically <20 so this almost never bites them; "otros" gets
    // truncated when the admin's platform roster grows large.
    return { recent: r.slice(0, 50), other: o.slice(0, 50) }
  }, [filtered, recentIds])

  if (recent.length === 0 && other.length === 0) return null

  // When there are no recents (cliente, or admin with no past pozos),
  // collapse to one group labeled the same way the previous UI did so
  // the empty-state still reads naturally.
  if (recent.length === 0) {
    return (
      <CommandGroup heading="Jugadores">
        {other.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            selected={selectedId === p.id}
            onPick={onPick}
          />
        ))}
      </CommandGroup>
    )
  }

  return (
    <>
      <CommandGroup heading="Recientes">
        {recent.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            selected={selectedId === p.id}
            onPick={onPick}
          />
        ))}
      </CommandGroup>
      {other.length > 0 && (
        <>
          <CommandSeparator />
          <CommandGroup heading="Otros jugadores">
            {other.map((p) => (
              <PlayerRow
                key={p.id}
                player={p}
                selected={selectedId === p.id}
                onPick={onPick}
              />
            ))}
          </CommandGroup>
        </>
      )}
    </>
  )
}

function PlayerRow({
  player,
  selected,
  onPick,
}: {
  player: PlayerRecord
  selected: boolean
  onPick: (p: PlayerRecord) => void
}) {
  return (
    <CommandItem
      value={player.id}
      keywords={[player.name, player.nameLower]}
      onSelect={() => onPick(player)}
    >
      <CheckIcon
        className={cn("size-4", selected ? "opacity-100" : "opacity-0")}
      />
      <span className="truncate">{player.name}</span>
      {player.linkedUid && (
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          vinculado
        </span>
      )}
    </CommandItem>
  )
}
