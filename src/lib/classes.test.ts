import { describe, it, expect } from "vitest"

import {
  CLASS_TIME_OPTIONS,
  dateFromInputValue,
  dateInputValue,
  defaultClassStart,
  formatDayHeading,
  groupByDay,
  isUpcoming,
  mergeSessionDays,
  sessionLabel,
  sessionStartsFromDays,
  splitClasses,
  studentsLabel,
  timeInputValue,
  toTimestamp,
  type ClassRecord,
} from "@/lib/classes"

function at(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

function makeClass(over: Partial<ClassRecord> = {}): ClassRecord {
  return {
    id: "c1",
    ownerId: "owner-1",
    startsAt: at(2026, 8, 26, 18, 0),
    durationMin: 60,
    students: [{ id: "p1", name: "Juan" }],
    packageId: "pkg-1",
    packageType: "individual",
    sessionIndex: 1,
    sessionCount: 1,
    status: "scheduled",
    location: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

describe("toTimestamp", () => {
  it("combines the native date + time inputs in local time", () => {
    expect(toTimestamp("2026-08-26", "18:30")).toBe(at(2026, 8, 26, 18, 30))
  })

  it("round-trips through the input formatters", () => {
    const ts = at(2026, 1, 5, 9, 5)
    expect(toTimestamp(dateInputValue(ts), timeInputValue(ts))).toBe(ts)
  })

  it("is NaN while either half is missing or malformed", () => {
    expect(toTimestamp("", "18:00")).toBeNaN()
    expect(toTimestamp("2026-08-26", "")).toBeNaN()
    expect(toTimestamp("26/08/2026", "18:00")).toBeNaN()
  })
})

describe("CLASS_TIME_OPTIONS", () => {
  it("runs from 07:00 to 23:00 in half hours", () => {
    expect(CLASS_TIME_OPTIONS[0]).toBe("07:00")
    expect(CLASS_TIME_OPTIONS[1]).toBe("07:30")
    expect(CLASS_TIME_OPTIONS[CLASS_TIME_OPTIONS.length - 1]).toBe("23:00")
    expect(CLASS_TIME_OPTIONS).toHaveLength(33)
  })
})

describe("dateFromInputValue", () => {
  it("lands on local midnight of that day", () => {
    const d = dateFromInputValue("2026-08-26")
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([
      2026, 7, 26, 0,
    ])
  })
})

describe("sessionStartsFromDays", () => {
  it("orders the picked sessions chronologically", () => {
    const starts = sessionStartsFromDays([
      { date: "2026-09-09", time: "18:00" },
      { date: "2026-09-02", time: "20:00" },
      { date: "2026-09-02", time: "09:00" },
    ])
    expect(starts).toEqual([
      at(2026, 9, 2, 9, 0),
      at(2026, 9, 2, 20, 0),
      at(2026, 9, 9, 18, 0),
    ])
  })
})

describe("mergeSessionDays", () => {
  it("keeps the time of days that stay selected", () => {
    const merged = mergeSessionDays(
      [{ date: "2026-09-02", time: "20:00" }],
      ["2026-09-02", "2026-09-09"],
      "18:00",
    )
    expect(merged).toEqual([
      { date: "2026-09-02", time: "20:00" },
      { date: "2026-09-09", time: "20:00" },
    ])
  })

  it("uses the fallback time for the very first pick", () => {
    expect(mergeSessionDays([], ["2026-09-02"], "18:00")).toEqual([
      { date: "2026-09-02", time: "18:00" },
    ])
  })

  it("drops days that were unselected and sorts the rest", () => {
    const merged = mergeSessionDays(
      [
        { date: "2026-09-02", time: "20:00" },
        { date: "2026-09-09", time: "19:00" },
      ],
      ["2026-09-16", "2026-09-09"],
      "18:00",
    )
    expect(merged).toEqual([
      { date: "2026-09-09", time: "19:00" },
      { date: "2026-09-16", time: "19:00" },
    ])
  })
})

describe("defaultClassStart", () => {
  it("proposes the next full hour", () => {
    expect(defaultClassStart(at(2026, 8, 26, 15, 42))).toBe(
      at(2026, 8, 26, 16, 0),
    )
  })

  it("rolls a late-night pick to the next morning", () => {
    expect(defaultClassStart(at(2026, 8, 26, 22, 40))).toBe(
      at(2026, 8, 27, 9, 0),
    )
  })

  it("does not skip a day when the +1 hour already crossed midnight", () => {
    expect(defaultClassStart(at(2026, 8, 26, 23, 30))).toBe(
      at(2026, 8, 27, 9, 0),
    )
  })

  it("moves a small-hours pick to the same morning", () => {
    expect(defaultClassStart(at(2026, 8, 26, 3, 10))).toBe(
      at(2026, 8, 26, 9, 0),
    )
  })
})

describe("sessionLabel", () => {
  it("stays quiet for a single class", () => {
    expect(sessionLabel(makeClass())).toBeNull()
  })

  it("counts the session within its package", () => {
    const record = makeClass({
      packageType: "pack5",
      sessionIndex: 2,
      sessionCount: 5,
    })
    expect(sessionLabel(record)).toBe("Clase 2 de 5")
  })
})

describe("studentsLabel", () => {
  it("reads naturally for one, two and more students", () => {
    expect(studentsLabel([{ id: "1", name: "Juan" }])).toBe("Juan")
    expect(
      studentsLabel([
        { id: "1", name: "Juan" },
        { id: "2", name: "Pedro" },
      ]),
    ).toBe("Juan y Pedro")
    expect(
      studentsLabel([
        { id: "1", name: "Juan" },
        { id: "2", name: "Pedro" },
        { id: "3", name: "Ana" },
      ]),
    ).toBe("Juan, Pedro y Ana")
  })

  it("falls back when every name is blank", () => {
    expect(studentsLabel([{ id: "1", name: "  " }])).toBe("Sin alumnos")
  })
})

describe("isUpcoming / splitClasses", () => {
  const now = at(2026, 8, 26, 18, 30)

  it("keeps a class in progress on the upcoming side", () => {
    const record = makeClass({ startsAt: at(2026, 8, 26, 18, 0) })
    expect(isUpcoming(record, now)).toBe(true)
  })

  it("drops it once it has finished", () => {
    const record = makeClass({ startsAt: at(2026, 8, 26, 17, 0) })
    expect(isUpcoming(record, now)).toBe(false)
  })

  it("treats taught and cancelled classes as history even if in the future", () => {
    const future = at(2026, 9, 2, 18, 0)
    expect(isUpcoming(makeClass({ startsAt: future, status: "done" }), now)).toBe(
      false,
    )
    expect(
      isUpcoming(makeClass({ startsAt: future, status: "cancelled" }), now),
    ).toBe(false)
  })

  it("sorts upcoming soonest-first and history most-recent-first", () => {
    const records = [
      makeClass({ id: "later", startsAt: at(2026, 9, 2, 18, 0) }),
      makeClass({ id: "old", startsAt: at(2026, 8, 1, 18, 0) }),
      makeClass({ id: "soon", startsAt: at(2026, 8, 27, 18, 0) }),
      makeClass({ id: "recent", startsAt: at(2026, 8, 20, 18, 0) }),
    ]
    const { upcoming, past } = splitClasses(records, now)
    expect(upcoming.map((r) => r.id)).toEqual(["soon", "later"])
    expect(past.map((r) => r.id)).toEqual(["recent", "old"])
  })
})

describe("groupByDay", () => {
  it("buckets by local day and preserves the incoming order", () => {
    const records = [
      makeClass({ id: "a", startsAt: at(2026, 8, 26, 9, 0) }),
      makeClass({ id: "b", startsAt: at(2026, 8, 26, 19, 0) }),
      makeClass({ id: "c", startsAt: at(2026, 8, 27, 9, 0) }),
    ]
    const groups = groupByDay(records)
    expect(groups.map((g) => g.key)).toEqual(["2026-08-26", "2026-08-27"])
    expect(groups[0].classes.map((r) => r.id)).toEqual(["a", "b"])
    expect(groups[1].classes.map((r) => r.id)).toEqual(["c"])
  })

  it("keeps a late-evening class on its own day, not the next one", () => {
    const groups = groupByDay([makeClass({ startsAt: at(2026, 8, 26, 23, 30) })])
    expect(groups[0].key).toBe("2026-08-26")
  })
})

describe("formatDayHeading", () => {
  const now = at(2026, 8, 26, 18, 0)

  it("names the days around today", () => {
    expect(formatDayHeading(at(2026, 8, 26, 7, 0), now)).toBe("Hoy")
    expect(formatDayHeading(at(2026, 8, 27, 23, 0), now)).toBe("Mañana")
    expect(formatDayHeading(at(2026, 8, 25, 12, 0), now)).toBe("Ayer")
  })

  it("falls back to a dated heading further out", () => {
    expect(formatDayHeading(at(2026, 9, 2, 18, 0), now)).not.toMatch(
      /Hoy|Mañana|Ayer/,
    )
  })
})
