/**
 * Tiny Web Audio alarm — three short beeps, repeated until something stops
 * it. Generated in code so we don't ship an audio asset. The AudioContext is
 * created lazily on first play and reused; browsers only allow audio after a
 * user gesture, so if the context can't start (e.g. the tab never got an
 * interaction) we fail silently — the visual "Tiempo terminado" state still
 * communicates.
 */
let ctx: AudioContext | null = null

/** One burst is ~0.85s of beeps; the rest is a breath before the next. */
const CYCLE_MS = 2200
/**
 * Safety cap (~5 min). The alarm is meant to ring until someone deals with
 * it, but a phone left in a bag shouldn't beep for the rest of the day and
 * flatten its battery.
 */
const MAX_CYCLES = 135

let cycleHandle: number | null = null
let cyclesPlayed = 0
/** Oscillators already scheduled, so `stop` can cut a burst mid-flight. */
const live = new Set<OscillatorNode>()

const listeners = new Set<() => void>()
let ringing = false

function setRinging(next: boolean): void {
  if (ringing === next) return
  ringing = next
  listeners.forEach((l) => l())
}

/** Whether the alarm is sounding right now. Pair with `subscribeTimerAlarm`. */
export function isTimerAlarmRinging(): boolean {
  return ringing
}

export function subscribeTimerAlarm(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  return ctx
}

function beep(at: number, durationSec: number, freq: number) {
  const audio = getContext()
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = "sine"
  osc.frequency.value = freq
  // Quick attack + exponential release so the beep doesn't click.
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durationSec)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(at)
  osc.stop(at + durationSec + 0.05)
  live.add(osc)
  osc.onended = () => {
    live.delete(osc)
  }
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return
  navigator.vibrate?.(pattern)
}

function playBurst(): void {
  const audio = getContext()
  if (!audio) return
  // resume() is async but we don't need to await: scheduled nodes fire as
  // soon as the context unblocks. If it never does (no prior gesture),
  // nothing plays and nothing throws.
  if (audio.state === "suspended") void audio.resume()
  const t = audio.currentTime
  beep(t, 0.18, 880)
  beep(t + 0.25, 0.18, 880)
  beep(t + 0.5, 0.35, 1175)
  // Haptic nudge on phones that support it — the alarm usually fires with
  // the device sitting courtside, vibration helps it get noticed.
  vibrate([180, 80, 180, 80, 320])
}

/**
 * Unlock the audio pipeline from inside a user gesture. The alarm itself
 * fires from a timer callback — never a gesture — and iOS refuses to resume
 * an AudioContext outside one, so without this the very first beep of a pozo
 * is silently swallowed on iPhones. Cheap and idempotent: call it from any
 * interaction.
 */
export function primeTimerAlarm(): void {
  const audio = getContext()
  if (!audio) return
  if (audio.state === "suspended") void audio.resume()
  try {
    // iOS wants a node to have actually run inside the gesture before it
    // treats the context as unlocked. One silent sample is enough.
    const source = audio.createBufferSource()
    source.buffer = audio.createBuffer(1, 1, audio.sampleRate)
    source.connect(audio.destination)
    source.start(0)
  } catch {
    // Nothing to recover — the visual "Tiempo terminado" state still works.
  }
}

/**
 * Start ringing, and keep ringing. Idempotent: calling it while already
 * ringing does nothing rather than stacking a second series of beeps on top.
 */
export function startTimerAlarm(): void {
  if (cycleHandle !== null) return
  cyclesPlayed = 1
  setRinging(true)
  playBurst()
  cycleHandle = window.setInterval(() => {
    if (cyclesPlayed >= MAX_CYCLES) {
      stopTimerAlarm()
      return
    }
    cyclesPlayed += 1
    playBurst()
  }, CYCLE_MS)
}

/**
 * Silence it. Cuts oscillators that are already scheduled, so the burst in
 * flight stops too instead of finishing after the tap.
 */
export function stopTimerAlarm(): void {
  if (cycleHandle !== null) {
    window.clearInterval(cycleHandle)
    cycleHandle = null
  }
  for (const osc of live) {
    try {
      osc.stop()
    } catch {
      // Already stopped — nothing to do.
    }
  }
  live.clear()
  vibrate(0)
  setRinging(false)
}
