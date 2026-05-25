import * as React from "react"

import { useAuth } from "@/contexts/auth-context"
import {
  patchPozo,
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

  React.useEffect(() => {
    if (!id || !user) {
      setPozo(null)
      setHydrated(true)
      return
    }
    setHydrated(false)
    const unsub = subscribePozo(id, (p) => {
      setPozo(p)
      setHydrated(true)
    })
    return unsub
  }, [id, user])

  const update = React.useCallback(
    (updater: (current: Pozo) => Pozo) => {
      if (!pozo) return
      const next = updater(pozo)
      void savePozo(next)
    },
    [pozo],
  )

  const patch = React.useCallback(
    (changes: Partial<Pozo>) => {
      if (!id) return
      void patchPozo(id, changes)
    },
    [id],
  )

  return { pozo, hydrated, update, patch }
}
