import {
  classEndsAt,
  packageLabel,
  sessionLabel,
  studentsLabel,
  type ClassRecord,
} from "@/lib/classes"
import { isIOS } from "@/lib/pwa"

/**
 * Hands the agenda to the phone's own calendar as an iCalendar (.ics) file.
 *
 * A web app can't write into the device calendar silently — there is no
 * browser API for it — so the closest thing to "automatic" is one tap that
 * lands the organizer on the calendar's own "add" sheet with every event
 * already filled in. That's what `openIcs` does, per platform:
 *
 *   - iOS previews any `text/calendar` navigation natively and offers
 *     "Agregar todo", so we open the file as a data: URL. A download would
 *     only drop it into Archivos and cost two more taps.
 *   - Everywhere else the file is downloaded; Android's download tray and a
 *     desktop double-click both hand it to the default calendar app.
 */

const PRODID = "-//Padel Galaxy//Clases//ES"
const MAX_LINE_OCTETS = 75

const encoder = new TextEncoder()

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

/** "20260826T210000Z" — UTC keeps the time right whatever zone imports it. */
export function icsDate(ts: number): string {
  const d = new Date(ts)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are escaped. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/**
 * RFC 5545 §3.1 folds content lines at 75 octets with CRLF + one space.
 * Counted in UTF-8 bytes rather than characters so an accented name can't
 * push a line past the limit.
 */
export function foldLine(line: string): string {
  const out: string[] = []
  let current = ""
  let octets = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // Continuation lines start with a space, which eats one of the octets.
    const limit = out.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1
    if (octets + size > limit) {
      out.push(current)
      current = ""
      octets = 0
    }
    current += char
    octets += size
  }
  out.push(current)
  return out.join("\r\n ")
}

function summaryFor(record: ClassRecord): string {
  return `Clase de pádel · ${studentsLabel(record.students)}`
}

function descriptionFor(record: ClassRecord): string {
  const parts = [packageLabel(record.packageType)]
  const session = sessionLabel(record)
  if (session) parts[0] += ` · ${session}`
  if (record.notes) parts.push(record.notes)
  return parts.join("\n")
}

function eventLines(record: ClassRecord, stamp: string): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${record.id}@padel-galaxy`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(record.startsAt)}`,
    `DTEND:${icsDate(classEndsAt(record))}`,
    `SUMMARY:${escapeText(summaryFor(record))}`,
    `DESCRIPTION:${escapeText(descriptionFor(record))}`,
  ]
  if (record.location) lines.push(`LOCATION:${escapeText(record.location)}`)
  lines.push("END:VEVENT")
  return lines
}

/**
 * One VEVENT per class. Cancelled sessions are left out — the organizer
 * wants their calendar to show what's actually happening, not a gap with a
 * strike-through.
 */
export function buildClassesIcs(
  records: ClassRecord[],
  now: number = Date.now(),
): string {
  const stamp = icsDate(now)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...records
      .filter((r) => r.status !== "cancelled")
      .flatMap((r) => eventLines(r, stamp)),
    "END:VCALENDAR",
  ]
  return lines.map(foldLine).join("\r\n") + "\r\n"
}

/** Classes worth putting on a calendar: everything not cancelled. */
export function exportableClasses(records: ClassRecord[]): ClassRecord[] {
  return records.filter((r) => r.status !== "cancelled")
}

export function icsFilename(records: ClassRecord[]): string {
  if (records.length === 1) {
    const d = new Date(records[0].startsAt)
    return `clase-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.ics`
  }
  return "clases-padel.ics"
}

/**
 * Deliver the file the way each platform turns into an "add to calendar"
 * sheet. Must run inside a user gesture — iOS needs it for `window.open`.
 * Returns how it was delivered so the caller can phrase the toast.
 */
export function openIcs(ics: string, filename: string): "opened" | "downloaded" {
  if (isIOS()) {
    const url = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
    // Popup blocked (in-app browsers do this): navigate the tab itself;
    // the calendar sheet still comes up over it.
    if (!window.open(url, "_blank")) window.location.assign(url)
    return "opened"
  }

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a moment to start the download before the URL dies.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return "downloaded"
}
