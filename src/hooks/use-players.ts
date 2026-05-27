import * as React from "react"
import { doc, onSnapshot } from "firebase/firestore"

import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import {
  subscribeAllPlayers,
  subscribeMyPlayer,
  subscribeUserPlayers,
  type PlayerRecord,
} from "@/lib/players"

export function usePlayers() {
  const { user, isAdmin } = useAuth()
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setPlayers([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    // Any admin (regular or super) sees every player in the system —
    // they need the full roster to compose pozos with people invited
    // by other organizers. Clientes still see only their own records
    // (owned + auto-created on signup). Rules already allow `isAdmin`
    // reads on any /players doc, so the broader query is safe.
    const unsub = isAdmin
      ? subscribeAllPlayers((list) => {
          setPlayers(list)
          setHydrated(true)
        })
      : subscribeUserPlayers(user.uid, (list) => {
          setPlayers(list)
          setHydrated(true)
        })
    return unsub
  }, [user, isAdmin])

  return { players, hydrated }
}

/**
 * Single-player accessor. Subscribes to `/players/{id}` directly so it
 * works for ANY caller the firestore rules allow (owner, linked cliente,
 * admin, or pre-claim invitee). Previously this filtered the owner's
 * roster — fine for organizers but always-null for clientes, since they
 * don't own any /players docs.
 *
 * Permission errors (e.g. cliente peeking at someone else's record)
 * surface as `player: null` after hydration, mirroring the "not found"
 * path so the UI can render a single "no encontrado" view.
 */
export function usePlayer(id: string) {
  const { user } = useAuth()
  const [player, setPlayer] = React.useState<PlayerRecord | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user || !id) {
      setPlayer(null)
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = onSnapshot(
      doc(db, "players", id),
      (snap) => {
        setPlayer(snap.exists() ? (snap.data() as PlayerRecord) : null)
        setHydrated(true)
      },
      (err) => {
        console.error("usePlayer subscription error:", err)
        setPlayer(null)
        setHydrated(true)
      },
    )
    return unsub
  }, [user, id])

  return { player, hydrated }
}

/**
 * The /players doc linked to the currently-signed-in user, or null if
 * none. Used by the site header to render "Mi perfil" (deep-link to
 * `/jugadores/<id>`) for cliente-tier users instead of the organizer-only
 * roster page. Admins typically won't have a linked record (they OWN the
 * roster but aren't IN it), so this returns null for them — the caller
 * should fall back to the regular "Jugadores" nav item.
 */
export function useMyPlayer() {
  const { user } = useAuth()
  const [player, setPlayer] = React.useState<PlayerRecord | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setPlayer(null)
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribeMyPlayer(user.uid, (p) => {
      setPlayer(p)
      setHydrated(true)
    })
    return unsub
  }, [user])

  return { player, hydrated }
}
