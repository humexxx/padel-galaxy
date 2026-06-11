/**
 * Tiny Web Audio alarm — three short beeps. Generated in code so we don't
 * ship an audio asset. The AudioContext is created lazily on first play
 * and reused; browsers only allow audio after a user gesture, so if the
 * context can't start (e.g. the tab never got an interaction) we fail
 * silently — the visual "Tiempo terminado" state still communicates.
 */
let ctx: AudioContext | null = null

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
}

export function playTimerAlarm(): void {
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
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.([180, 80, 180, 80, 320])
  }
}
