import * as React from "react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import {
  savePozo,
  subscribeActivePozos,
  subscribeAllPozos,
  subscribeParticipantPozos,
  subscribePozo,
  subscribeUserPozos,
} from "@/lib/storage"
import type { Pozo } from "@/lib/pozo/types"

/**
 * `activeOnly` is a hint, not a filter: it only narrows the super-admin's
 * system-wide query. Callers that care still check `status` themselves.
 */
export function usePozos({ activeOnly = false }: { activeOnly?: boolean } = {}) {
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
      const subscribe = activeOnly ? subscribeActivePozos : subscribeAllPozos
      return subscribe(
        (list) => {
          setPozos(list)
          setHydrated(true)
        },
        (err) => {
          console.error("usePozos subscription error:", err)
          setHydrated(true)
        },
      )
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
    const unsubOwned = subscribeUserPozos(
      user.uid,
      (list) => {
        owned = list
        ownedReady = true
        flush()
      },
      (err) => {
        // Don't hang hydration if the owner query fails — show whatever
        // the participant query gave us.
        console.error("subscribeUserPozos failed:", err)
        ownedReady = true
        flush()
      },
    )
    const unsubParticipant = subscribeParticipantPozos(
      user.uid,
      (list) => {
        participant = list
        participantReady = true
        flush()
      },
      (err) => {
        // Same idea: if the composite index is still building or the
        // query is denied, log it and treat the participant set as empty
        // so the empty-state hint can still render.
        console.error("subscribeParticipantPozos failed:", err)
        participantReady = true
        flush()
      },
    )
    return () => {
      unsubOwned()
      unsubParticipant()
    }
  }, [user, isSuperAdmin, activeOnly])

  return { pozos, hydrated }
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
    const unsub = subscribePozo(
      id,
      (p) => {
        pozoRef.current = p
        setPozo(p)
        setHydrated(true)
      },
      (err) => {
        // Denied (not yours, or deleted) reads as "not found" rather than
        // leaving the page on its loading state forever.
        console.error("usePozo subscription error:", err)
        pozoRef.current = null
        setPozo(null)
        setHydrated(true)
      },
    )
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
    // Offline the write just waits in the queue; a rejection means the
    // server refused it (permissions), which the user needs to know.
    savePozo(next).catch((err) => {
      console.error("savePozo failed:", err)
      toast.error("No se pudo guardar el cambio en el pozo")
    })
  }, [])

  return { pozo, hydrated, update }
}
