import { describe, it, expect } from "vitest"

import {
  DEFAULT_CONFIG,
  advanceRound,
  beginPlay,
  computeMatchDurationMin,
  computeRoundEndsAt,
  createPozo,
  recordMatchResult,
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

describe("per-round clock — roundStartedAt / computeRoundEndsAt", () => {
  function startPlaying(now: number) {
    const pozo = createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: makeConfig({ totalDurationMin: 90, warmupMin: 5 }),
    })
    return beginPlay(startPozo(pozo, now), now)
  }

  it("beginPlay stamps roundStartedAt", () => {
    const playing = startPlaying(1_000_000)
    expect(playing.status).toBe("playing")
    expect(playing.roundStartedAt).toBe(1_000_000)
  })

  it("computeRoundEndsAt = roundStartedAt + match duration", () => {
    const playing = startPlaying(1_000_000)
    const matchMs =
      computeMatchDurationMin(playing.config, playing.totalRounds) * 60_000
    expect(computeRoundEndsAt(playing)).toBe(1_000_000 + matchMs)
  })

  it("advanceRound refreshes roundStartedAt for the next round", () => {
    let playing = startPlaying(1_000_000)
    for (const m of playing.matches) {
      playing = recordMatchResult(playing, m.id, 6, 3)
    }
    const advanced = advanceRound(playing, 2_000_000)
    expect(advanced.currentRound).toBe(1)
    expect(advanced.roundStartedAt).toBe(2_000_000)
  })

  it("returns null while not playing and on legacy docs without the field", () => {
    const pozo = createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: makeConfig(),
    })
    expect(computeRoundEndsAt(pozo)).toBeNull()
    expect(computeRoundEndsAt(startPozo(pozo, 1_000_000))).toBeNull()
    const legacy = { ...startPlaying(1_000_000), roundStartedAt: undefined }
    expect(computeRoundEndsAt(legacy)).toBeNull()
  })
})

describe("createPozo — optional groupId", () => {
  it("omits the groupId key entirely when no group is picked", () => {
    const pozo = createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: makeConfig(),
    })
    // Not just `undefined` — the key must be absent. Firestore rejects
    // `undefined` as a field value, so setDoc() would throw on the whole
    // document and the pozo would never get created.
    expect("groupId" in pozo).toBe(false)
    expect(Object.values(pozo).every((v) => v !== undefined)).toBe(true)
  })

  it("keeps the groupId when one is picked", () => {
    const pozo = createPozo({
      name: "T",
      ownerId: "o",
      players: PLAYERS,
      config: makeConfig(),
      groupId: "g1",
    })
    expect(pozo.groupId).toBe("g1")
  })
})
