import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  removePozo,
  savePozo,
  subscribePozo,
  subscribeUserPozos,
} from "@/lib/storage"
import type { Pozo } from "@/lib/pozo/types"

export function usePozos() {
  const { user } = useAuth()
  const [pozos, setPozos] = React.useState<Pozo[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    if (!user) {
      setPozos([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribeUserPozos(user.uid, (list) => {
      setPozos(list)
      setHydrated(true)
    })
    return unsub
  }, [user])

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
