export function formatDuration(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  const s = clamped % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

export function formatRelative(ts: number, now: number = Date.now()): string {
  const diffSec = Math.round((now - ts) / 1000)
  if (diffSec < 60) return "hace un momento"
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `hace ${diffHr} h`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `hace ${diffDay} d`
  const date = new Date(ts)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}
