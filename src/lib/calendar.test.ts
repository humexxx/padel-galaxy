// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildClassesIcs,
  escapeText,
  exportableClasses,
  foldLine,
  icsDate,
  icsFilename,
  openIcs,
} from "@/lib/calendar"
import type { ClassRecord } from "@/lib/classes"

function makeClass(over: Partial<ClassRecord> = {}): ClassRecord {
  return {
    id: "c1",
    ownerId: "owner-1",
    startsAt: Date.UTC(2026, 7, 26, 21, 0, 0),
    durationMin: 60,
    students: [{ id: "p1", name: "Juan Pérez" }],
    packageId: "pkg-1",
    packageType: "pack5",
    sessionIndex: 2,
    sessionCount: 5,
    status: "scheduled",
    location: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

describe("icsDate", () => {
  it("formats as a UTC basic timestamp", () => {
    expect(icsDate(Date.UTC(2026, 7, 26, 21, 5, 9))).toBe("20260826T210509Z")
  })
})

describe("escapeText", () => {
  it("escapes the characters iCalendar reserves", () => {
    expect(escapeText("a;b,c\\d\nnext")).toBe("a\\;b\\,c\\\\d\\nnext")
  })
})

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Clase")).toBe("SUMMARY:Clase")
  })

  it("folds at 75 octets with a continuation space", () => {
    const line = "DESCRIPTION:" + "x".repeat(100)
    const folded = foldLine(line)
    const parts = folded.split("\r\n ")
    expect(parts).toHaveLength(2)
    expect(parts[0]).toHaveLength(75)
    expect(parts.join("")).toBe(line)
  })

  it("counts bytes, not characters, so accents never overrun a line", () => {
    const line = "SUMMARY:" + "é".repeat(60)
    const encoder = new TextEncoder()
    for (const part of foldLine(line).split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75)
    }
  })
})

describe("buildClassesIcs", () => {
  const now = Date.UTC(2026, 7, 20, 12, 0, 0)

  it("produces one event per class with the right times and text", () => {
    const ics = buildClassesIcs(
      [makeClass({ location: "Cancha 2", notes: "Volea, bandeja" })],
      now,
    )
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true)
    expect(ics).toContain("UID:c1@padel-galaxy")
    expect(ics).toContain("DTSTAMP:20260820T120000Z")
    expect(ics).toContain("DTSTART:20260826T210000Z")
    expect(ics).toContain("DTEND:20260826T220000Z")
    expect(ics).toContain("SUMMARY:Clase de pádel · Juan Pérez")
    expect(ics).toContain("DESCRIPTION:Pack de 5 · Clase 2 de 5\\nVolea\\, bandeja")
    expect(ics).toContain("LOCATION:Cancha 2")
  })

  it("skips cancelled sessions", () => {
    const ics = buildClassesIcs(
      [
        makeClass({ id: "keep" }),
        makeClass({ id: "gone", status: "cancelled" }),
      ],
      now,
    )
    expect(ics).toContain("UID:keep@padel-galaxy")
    expect(ics).not.toContain("UID:gone@padel-galaxy")
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })

  it("omits LOCATION when there is none", () => {
    expect(buildClassesIcs([makeClass()], now)).not.toContain("LOCATION:")
  })
})

describe("exportableClasses / icsFilename", () => {
  it("drops cancelled classes", () => {
    const list = [makeClass({ id: "a" }), makeClass({ id: "b", status: "cancelled" })]
    expect(exportableClasses(list).map((r) => r.id)).toEqual(["a"])
  })

  it("names a single class by its local date and a batch generically", () => {
    const single = makeClass({ startsAt: new Date(2026, 7, 26, 18).getTime() })
    expect(icsFilename([single])).toBe("clase-2026-08-26.ics")
    expect(icsFilename([single, makeClass({ id: "c2" })])).toBe("clases-padel.ics")
  })
})

describe("openIcs (download branch)", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("clicks a download link named after the file", () => {
    // jsdom has no object URLs; stub just enough to follow the anchor.
    const createObjectURL = vi.fn(() => "blob:test")
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this)
    })

    const how = openIcs("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", "clases-padel.ics")

    expect(how).toBe("downloaded")
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe("clases-padel.ics")
    expect(clicked[0].href).toBe("blob:test")
    // The anchor is a throwaway — it must not linger in the document.
    expect(document.body.contains(clicked[0])).toBe(false)
  })
})
