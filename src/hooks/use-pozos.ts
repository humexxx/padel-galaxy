"use client"

import * as React from "react"

import { STORAGE_EVENT, emitPozosUpdated, pozoStorage } from "@/lib/storage"
import type { Pozo } from "@/lib/pozo/types"

let cachedList: Pozo[] = []
let initialized = false
const listListeners = new Set<() => void>()

function notifyAll() {
  listListeners.forEach((l) => l())
}

function refreshCache() {
  cachedList = pozoStorage.list()
  notifyAll()
}

function handleStorageEvent(e: StorageEvent) {
  if (e.key === null || e.key.startsWith("padel-galaxy")) refreshCache()
}

function ensureInitialized() {
  if (initialized) return
  initialized = true
  cachedList = pozoStorage.list()
  if (typeof window !== "undefined") {
    window.addEventListener(STORAGE_EVENT, refreshCache)
    window.addEventListener("storage", handleStorageEvent)
  }
}

function subscribe(callback: () => void) {
  ensureInitialized()
  listListeners.add(callback)
  return () => {
    listListeners.delete(callback)
  }
}

function getListSnapshot(): Pozo[] {
  return cachedList
}

const emptyList: Pozo[] = []

function noopSubscribe() {
  return () => undefined
}

function useHydrated() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

export function usePozos() {
  const pozos = React.useSyncExternalStore<Pozo[]>(
    subscribe,
    getListSnapshot,
    () => emptyList,
  )
  const hydrated = useHydrated()

  const save = React.useCallback((pozo: Pozo) => {
    pozoStorage.save(pozo)
    emitPozosUpdated()
  }, [])

  const remove = React.useCallback((id: string) => {
    pozoStorage.remove(id)
    emitPozosUpdated()
  }, [])

  return { pozos, hydrated, save, remove }
}

export function usePozo(id: string | undefined) {
  const pozos = React.useSyncExternalStore<Pozo[]>(
    subscribe,
    getListSnapshot,
    () => emptyList,
  )
  const hydrated = useHydrated()

  const pozo = React.useMemo(
    () => (id ? pozos.find((p) => p.id === id) ?? null : null),
    [pozos, id],
  )

  const update = React.useCallback(
    (updater: (current: Pozo) => Pozo) => {
      if (!id) return
      const current = pozoStorage.get(id)
      if (!current) return
      const next = updater(current)
      pozoStorage.save(next)
      emitPozosUpdated()
    },
    [id],
  )

  return { pozo, hydrated, update }
}
