// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"

import { PozoTimer } from "./pozo-timer"

/**
 * Stateful fake of the alarm module: the component reads `ringing` through
 * useSyncExternalStore, so a plain vi.fn() wouldn't let the stop button ever
 * render.
 */
const alarmState = { ringing: false, listeners: new Set<() => void>() }
const startTimerAlarm = vi.fn(() => {
  alarmState.ringing = true
  alarmState.listeners.forEach((l) => l())
})
const stopTimerAlarm = vi.fn(() => {
  alarmState.ringing = false
  alarmState.listeners.forEach((l) => l())
})
const primeTimerAlarm = vi.fn()

vi.mock("@/lib/alarm", () => ({
  startTimerAlarm: () => startTimerAlarm(),
  stopTimerAlarm: () => stopTimerAlarm(),
  primeTimerAlarm: () => primeTimerAlarm(),
  isTimerAlarmRinging: () => alarmState.ringing,
  subscribeTimerAlarm: (cb: () => void) => {
    alarmState.listeners.add(cb)
    return () => alarmState.listeners.delete(cb)
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  alarmState.ringing = false
  alarmState.listeners.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("PozoTimer", () => {
  it("renders the main countdown with its label", () => {
    render(<PozoTimer label="Partido · Ronda 1 de 7" endsAt={Date.now() + 90_000} />)
    expect(screen.getByText("Partido · Ronda 1 de 7")).toBeInTheDocument()
    expect(screen.getByText("01:30")).toBeInTheDocument()
    expect(screen.getByText("Tiempo restante")).toBeInTheDocument()
  })

  it("renders the secondary corner countdown when provided", () => {
    render(
      <PozoTimer
        label="Partido"
        endsAt={Date.now() + 60_000}
        secondary={{ label: "Pozo", endsAt: Date.now() + 30 * 60_000 }}
      />,
    )
    expect(screen.getByText("Pozo")).toBeInTheDocument()
    expect(screen.getByText("30:00")).toBeInTheDocument()
  })

  it("starts the alarm exactly when the countdown crosses zero", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() + 1_500} alarm />)
    expect(startTimerAlarm).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(startTimerAlarm).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Tiempo terminado")).toBeInTheDocument()
    // Further ticks must not re-trigger it.
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(startTimerAlarm).toHaveBeenCalledTimes(1)
  })

  it("stays silent when mounted with an already-expired countdown", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() - 5_000} alarm />)
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(startTimerAlarm).not.toHaveBeenCalled()
  })

  it("offers a stop button while ringing, and silences it on click", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() + 1_000} alarm />)
    expect(screen.queryByRole("button", { name: /Detener alarma/ })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    const stop = screen.getByRole("button", { name: /Detener alarma/ })

    act(() => {
      stop.click()
    })
    expect(stopTimerAlarm).toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /Detener alarma/ })).toBeNull()
  })

  it("silences itself when the clock moves on to the next step", () => {
    // Warmup ends → alarm rings → "Empezar a jugar" pushes endsAt forward.
    const { rerender } = render(
      <PozoTimer label="Calentamiento" endsAt={Date.now() + 1_000} alarm />,
    )
    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    expect(startTimerAlarm).toHaveBeenCalledTimes(1)
    stopTimerAlarm.mockClear()

    act(() => {
      rerender(<PozoTimer label="Partido" endsAt={Date.now() + 600_000} alarm />)
    })
    expect(stopTimerAlarm).toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /Detener alarma/ })).toBeNull()
  })

  it("silences itself when unmounted", () => {
    const { unmount } = render(
      <PozoTimer label="Partido" endsAt={Date.now() + 1_000} alarm />,
    )
    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    stopTimerAlarm.mockClear()
    unmount()
    expect(stopTimerAlarm).toHaveBeenCalled()
  })

  it("silences a ringing alarm the moment the bell is muted", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() + 1_000} alarm />)
    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    stopTimerAlarm.mockClear()
    act(() => {
      screen.getByRole("button", { name: "Silenciar alarma" }).click()
    })
    expect(stopTimerAlarm).toHaveBeenCalled()
  })

  it("does not ring while the bell toggle is muted, and persists the choice", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() + 1_000} alarm />)
    act(() => {
      screen.getByRole("button", { name: "Silenciar alarma" }).click()
    })
    expect(
      screen.getByRole("button", { name: "Activar alarma" }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem("pg.timer-alarm-enabled")).toBe("0")
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(startTimerAlarm).not.toHaveBeenCalled()
  })

  it("unlocks audio on the first interaction so iOS lets the beep through", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() + 60_000} alarm />)
    expect(primeTimerAlarm).not.toHaveBeenCalled()
    act(() => {
      window.dispatchEvent(new Event("pointerdown"))
    })
    expect(primeTimerAlarm).toHaveBeenCalled()
  })

  it("does not try to unlock audio when the alarm is muted", () => {
    window.localStorage.setItem("pg.timer-alarm-enabled", "0")
    render(<PozoTimer label="Partido" endsAt={Date.now() + 60_000} alarm />)
    act(() => {
      window.dispatchEvent(new Event("pointerdown"))
    })
    expect(primeTimerAlarm).not.toHaveBeenCalled()
  })

  it("renders no bell toggle when the alarm feature is off", () => {
    render(<PozoTimer label="Calentamiento" endsAt={Date.now() + 1_000} />)
    expect(
      screen.queryByRole("button", { name: /alarma/i }),
    ).not.toBeInTheDocument()
  })
})
