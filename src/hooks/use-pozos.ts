import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  removePozo,
  savePozo,
  subscribeAllPozos,
  subscribeParticipantPozos,
  subscribePozo,
  subscribeUserPozos,
} from "@/lib/storage"
import type { Pozo } from "@/lib/pozo/types"

export function usePozos() {
  const { user, isSuperAdmin } = useAuth()
  const [pozos, setPozos] = React.useState<Pozo[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setPozos([])
      setHydrated(true)
      return
    }
    setHydrated(false)

    // Super-admin sees every pozo in the system — single broad query, no
    // need to also pull "participant" pozos since `all` already covers them.
    if (isSuperAdmin) {
      const unsub = subscribeAllPozos((list) => {
        setPozos(list)
        setHydrated(true)
      })
      return unsub
    }

    // Everyone else gets the union of "pozos I own" + "pozos I'm a linked
    // player in". Merged by id (deduped — owner can also be a participant)
    // and sorted desc by createdAt to preserve the original ordering.
    let owned: Pozo[] = []
    let participant: Pozo[] = []
    let ownedReady = false
    let participantReady = false
    const flush = () => {
      const byId = new Map<string, Pozo>()
      for (const p of owned) byId.set(p.id, p)
      for (const p of participant) if (!byId.has(p.id)) byId.set(p.id, p)
      const merged = [...byId.values()].sort(
        (a, b) => b.createdAt - a.createdAt,
      )
      setPozos(merged)
      if (ownedReady && participantReady) setHydrated(true)
    }
    const unsubOwned = subscribeUserPozos(user.uid, (list) => {
      owned = list
      ownedReady = true
      flush()
    })
    const unsubParticipant = subscribeParticipantPozos(user.uid, (list) => {
      participant = list
      participantReady = true
      flush()
    })
    return () => {
      unsubOwned()
      unsubParticipant()
    }
  }, [user, isSuperAdmin])

  const save = React.useCallback((pozo: Pozo) => {
    void savePozo(pozo)
  }, [])

  const remove = React.useCallback((id: string) => {
    void removePozo(id)
  }, [])

  return { pozos, hydrated, save, remove }
}

export function usePozo(id: string | undefined) {
  const { user } = useAuth()
  const [pozo, setPozo] = React.useState<Pozo | null>(null)
  const [hydrated, setHydrated] = React.useState(false)
  // Always-fresh ref to the latest pozo. `update()` reads from here instead
  // of closing over `pozo`, so two near-simultaneous saves (e.g. debounced
  // MatchCard writes from different cards) both see the merged-latest state
  // and don't clobber each other. Without this, the second `updater` would
  // run against a stale base and the first edit would be lost on save.
  const pozoRef = React.useRef<Pozo | null>(null)

  React.useEffect(() => {
    if (!id || !user) {
      setPozo(null)
      pozoRef.current = null
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribePozo(id, (p) => {
      pozoRef.current = p
      setPozo(p)
      setHydrated(true)
    })
    return unsub
  }, [id, user])

  // Dep-less callback: the ref makes `pozo` accessible without making the
  // function identity change every Firestore push. Stable identity also means
  // child components that depend on this callback (e.g. PozoView → MatchCard)
  // don't re-render just because the parent's pozo state ticked.
  const update = React.useCallback((updater: (current: Pozo) => Pozo) => {
    const latest = pozoRef.current
    if (!latest) return
    const next = updater(latest)
    pozoRef.current = next
    void savePozo(next)
  }, [])

  return { pozo, hydrated, update }
}
