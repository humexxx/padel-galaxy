import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import { usePlayers } from "@/hooks/use-players"
import { syncGroupParticipants } from "@/lib/groups"
import { reconcileLinkedUids } from "@/lib/pozo/linked-uids"
import { patchPozo } from "@/lib/storage"
import type { Pozo } from "@/lib/pozo/types"

/**
 * Repairs stale `pozo.linkedUids` for the pozos the current user can write
 * to. See `reconcileLinkedUids` for why they go stale.
 *
 * It has to run organizer-side: the Firestore update rule only lets the
 * owner or an admin write a pozo, so the player who just linked their
 * account cannot grant themselves access. The practical consequence is
 * that access appears the next time the organizer opens the app rather
 * than the instant the player signs in.
 *
 * Writes only on a real diff, so the steady state is zero writes.
 */
export function useLinkedUidsSync(pozos: Pozo[]): void {
  const { user, isAdmin } = useAuth()
  const { players, hydrated } = usePlayers()
  // Pozos already patched this session. The Firestore snapshot echoes the
  // write back and reconcile would then return null anyway — this just
  // makes a write loop impossible if that echo is ever delayed.
  const patched = React.useRef(new Set<string>())

  React.useEffect(() => {
    if (!user || !hydrated || players.length === 0 || pozos.length === 0) return

    const linkedUidByPlayerId = new Map(players.map((p) => [p.id, p.linkedUid]))

    for (const pozo of pozos) {
      // Skip what we can't write — a cliente's participant pozos would just
      // bounce off the rules.
      if (!isAdmin && pozo.ownerId !== user.uid) continue
      if (patched.current.has(pozo.id)) continue

      const next = reconcileLinkedUids(pozo, linkedUidByPlayerId)
      if (!next) continue

      patched.current.add(pozo.id)
      patchPozo(pozo.id, { linkedUids: next }).catch((err) => {
        // Non-fatal: the organizer's own view is unaffected, and the next
        // session retries. Clear the guard so that retry can happen.
        patched.current.delete(pozo.id)
        console.error("linkedUids sync failed:", err)
      })
      // Mirror onto the group so the participant can read it too — same
      // denormalization pozo-form does on create.
      if (pozo.groupId) {
        syncGroupParticipants(pozo.groupId, next).catch((err) => {
          console.error("group participants sync failed:", err)
        })
      }
    }
  }, [pozos, players, hydrated, user, isAdmin])
}
