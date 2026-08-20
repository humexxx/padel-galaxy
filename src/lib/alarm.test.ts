// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * jsdom ships no Web Audio, so stub just enough of it to observe what the
 * alarm schedules. Counting oscillators is how we count beeps.
 */
function installAudioStub() {
  const created: { stop: ReturnType<typeof vi.fn> }[] = []
  class FakeAudioContext {
    state = "running"
    currentTime = 0
    sampleRate = 44100
    resume = vi.fn()
    destination = {}
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
    }
    createOscillator() {
      const osc = {
        type: "",
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      created.push(osc)
      return osc
    }
    createBuffer() {
      return {}
    }
    createBufferSource() {
      return { buffer: null, connect: vi.fn(), start: vi.fn() }
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext)
  return created
}

let oscillators: ReturnType<typeof installAudioStub>
let alarm: typeof import("./alarm")

beforeEach(async () => {
  vi.useFakeTimers()
  oscillators = installAudioStub()
  vi.stubGlobal("navigator", { ...navigator, vibrate: vi.fn() })
  vi.resetModules()
  alarm = await import("./alarm")
})

afterEach(() => {
  alarm.stopTimerAlarm()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Three beeps per burst. */
const BEEPS_PER_BURST = 3

describe("timer alarm", () => {
  it("keeps beeping until it is stopped", () => {
    alarm.startTimerAlarm()
    expect(oscillators).toHaveLength(BEEPS_PER_BURST)

    vi.advanceTimersByTime(2200)
    expect(oscillators).toHaveLength(BEEPS_PER_BURST * 2)

    vi.advanceTimersByTime(2200 * 5)
    expect(oscillators).toHaveLength(BEEPS_PER_BURST * 7)

    alarm.stopTimerAlarm()
    vi.advanceTimersByTime(2200 * 10)
    expect(oscillators).toHaveLength(BEEPS_PER_BURST * 7)
  })

  it("reports whether it is ringing, and notifies subscribers", () => {
    const seen: boolean[] = []
    const unsub = alarm.subscribeTimerAlarm(() =>
      seen.push(alarm.isTimerAlarmRinging()),
    )
    expect(alarm.isTimerAlarmRinging()).toBe(false)

    alarm.startTimerAlarm()
    expect(alarm.isTimerAlarmRinging()).toBe(true)

    alarm.stopTimerAlarm()
    expect(alarm.isTimerAlarmRinging()).toBe(false)
    expect(seen).toEqual([true, false])
    unsub()
  })

  it("does not stack a second series when started twice", () => {
    alarm.startTimerAlarm()
    alarm.startTimerAlarm()
    alarm.startTimerAlarm()
    vi.advanceTimersByTime(2200)
    // Two bursts total, not six — the extra starts were no-ops.
    expect(oscillators).toHaveLength(BEEPS_PER_BURST * 2)
  })

  it("cuts the burst already in flight instead of letting it finish", () => {
    alarm.startTimerAlarm()
    alarm.stopTimerAlarm()
    for (const osc of oscillators) expect(osc.stop).toHaveBeenCalled()
  })

  it("vibrates on every burst and cancels the buzz on stop", () => {
    const vibrate = navigator.vibrate as ReturnType<typeof vi.fn>
    alarm.startTimerAlarm()
    expect(vibrate).toHaveBeenCalledWith([180, 80, 180, 80, 320])
    vi.advanceTimersByTime(2200)
    expect(vibrate).toHaveBeenCalledTimes(2)
    alarm.stopTimerAlarm()
    expect(vibrate).toHaveBeenLastCalledWith(0)
  })

  it("gives up after ~5 minutes so a forgotten phone doesn't beep all day", () => {
    alarm.startTimerAlarm()
    vi.advanceTimersByTime(2200 * 200)
    expect(alarm.isTimerAlarmRinging()).toBe(false)
    // 135 bursts is the documented cap.
    expect(oscillators).toHaveLength(BEEPS_PER_BURST * 135)
  })

  it("stays silent when the browser gives us no audio at all", () => {
    vi.stubGlobal("AudioContext", undefined)
    vi.resetModules()
    // Re-import so the module picks up the missing constructor.
    return import("./alarm").then((fresh) => {
      expect(() => fresh.startTimerAlarm()).not.toThrow()
      fresh.stopTimerAlarm()
    })
  })
})
