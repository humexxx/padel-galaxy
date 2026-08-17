import type { Pozo } from "./types"

/**
 * `pozo.linkedUids` is a snapshot: `createPozo` fills it from whichever
 * players already had a linked account at the moment the pozo was created.
 * When someone claims their invite afterwards, every pozo they already
 * played in keeps a stale array — so the participant read rule
 * (`auth.uid in resource.data.linkedUids`) and the
 * `where('linkedUids', 'array-contains', uid)` query both miss them, and
 * the player sees nothing after signing in.
 *
 * This recomputes the array from the current roster. Returns the new value
 * when something is missing, or `null` when the pozo is already correct so
 * callers can skip the write.
 *
 * Union only — uids are never removed. Two reasons:
 *
 *   1. A non-admin organizer only loads THEIR OWN roster, so players
 *      belonging to another organizer are simply absent from the map.
 *      Subtracting would revoke access based on missing data, not on a
 *      real change.
 *   2. Access to a pozo you actually played in shouldn't disappear
 *      because the organizer later tidied up their roster.
 */
export function reconcileLinkedUids(
  pozo: Pick<Pozo, "players" | "linkedUids">,
  linkedUidByPlayerId: ReadonlyMap<string, string | null | undefined>,
): string[] | null {
  const merged = new Set(pozo.linkedUids ?? [])
  let added = false
  for (const player of pozo.players) {
    const uid = linkedUidByPlayerId.get(player.id)
    if (typeof uid !== "string" || uid.length === 0) continue
    if (merged.has(uid)) continue
    merged.add(uid)
    added = true
  }
  return added ? [...merged] : null
}
