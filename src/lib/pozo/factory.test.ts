import { describe, it, expect } from "vitest"

import {
  DEFAULT_CONFIG,
  computeMatchDurationMin,
  createPozo,
  startPozo,
} from "./factory"
import type { PozoConfig } from "./types"

function makeConfig(overrides: Partial<PozoConfig> = {}): PozoConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}

const PLAYERS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `P${i + 1}`,
}))

describe("startPozo — warmupIncludedInTotal flag", () => {
  it("default (true): endsAt = startedAt + totalDurationMin (warmup eats into total)", () => {
    const pozo = createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: makeConfig({
        totalDurationMin: 90,
        warmupMin: 5,
        warmupIncludedInTotal: true,
      }),
    })
    const started = startPozo(pozo, 1_000_000)
    expect(started.startedAt).toBe(1_000_000)
    expect(started.warmupEndsAt).toBe(1_000_000 + 5 * 60_000)
    expect(started.endsAt).toBe(1_000_000 + 90 * 60_000)
    // Real play time = 90 - 5 = 85min after warmup
    expect((started.endsAt ?? 0) - (started.warmupEndsAt ?? 0)).toBe(85 * 60_000)
  })

  it("false: endsAt = startedAt + warmup + total (warmup added on top)", () => {
    const pozo = createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: makeConfig({
        totalDurationMin: 90,
        warmupMin: 5,
        warmupIncludedInTotal: false,
      }),
    })
    const started = startPozo(pozo, 1_000_000)
    expect(started.warmupEndsAt).toBe(1_000_000 + 5 * 60_000)
    expect(started.endsAt).toBe(1_000_000 + (5 + 90) * 60_000)
    // Play time = 90min, warmup is separate
    expect((started.endsAt ?? 0) - (started.warmupEndsAt ?? 0)).toBe(90 * 60_000)
  })

  it("missing flag is treated as true (backwards-compat for old pozos)", () => {
    const pozo = createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: makeConfig({ totalDurationMin: 90, warmupMin: 5 }),
    })
    // Strip the flag to simulate an old Firestore doc.
    const oldShape = { ...pozo, config: { ...pozo.config, warmupIncludedInTotal: undefined } }
    const started = startPozo(oldShape, 1_000_000)
    expect(started.endsAt).toBe(1_000_000 + 90 * 60_000)
  })
})

describe("computeMatchDurationMin — warmupIncludedInTotal flag", () => {
  it("included (true): playMin = total - warmup, divided across rounds", () => {
    const config = makeConfig({
      totalDurationMin: 90,
      warmupMin: 5,
      warmupIncludedInTotal: true,
    })
    // 7 rounds → 85min play / 7 ≈ 12.14
    expect(computeMatchDurationMin(config, 7)).toBeCloseTo(85 / 7, 5)
  })

  it("not included (false): playMin = totalDurationMin (warmup separate)", () => {
    const config = makeConfig({
      totalDurationMin: 90,
      warmupMin: 5,
      warmupIncludedInTotal: false,
    })
    expect(computeMatchDurationMin(config, 7)).toBeCloseTo(90 / 7, 5)
  })

  it("missing flag defaults to included (true) — backwards-compat", () => {
    const config: PozoConfig = {
      ...DEFAULT_CONFIG,
      totalDurationMin: 90,
      warmupMin: 5,
    }
    delete config.warmupIncludedInTotal
    expect(computeMatchDurationMin(config, 7)).toBeCloseTo(85 / 7, 5)
  })

  it("returns 0 for 0 rounds (no division by zero)", () => {
    expect(computeMatchDurationMin(makeConfig(), 0)).toBe(0)
  })
})
