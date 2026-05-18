import type { Pozo } from "@/lib/pozo/types"

const KEY = "padel-galaxy:pozos"

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window
}

function readAll(): Pozo[] {
  const w = safeWindow()
  if (!w) return []
  try {
    const raw = w.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Pozo[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(pozos: Pozo[]): void {
  const w = safeWindow()
  if (!w) return
  w.localStorage.setItem(KEY, JSON.stringify(pozos))
}

export const pozoStorage = {
  list(): Pozo[] {
    return readAll().sort((a, b) => b.createdAt - a.createdAt)
  },
  get(id: string): Pozo | null {
    return readAll().find((p) => p.id === id) ?? null
  },
  save(pozo: Pozo): void {
    const all = readAll()
    const idx = all.findIndex((p) => p.id === pozo.id)
    if (idx >= 0) all[idx] = pozo
    else all.push(pozo)
    writeAll(all)
  },
  remove(id: string): void {
    writeAll(readAll().filter((p) => p.id !== id))
  },
}

export const STORAGE_EVENT = "padel-galaxy:pozos-updated"

export function emitPozosUpdated(): void {
  const w = safeWindow()
  if (!w) return
  w.dispatchEvent(new CustomEvent(STORAGE_EVENT))
}
