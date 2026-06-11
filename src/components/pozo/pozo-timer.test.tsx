// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"

import { PozoTimer } from "./pozo-timer"

vi.mock("@/lib/alarm", () => ({
  playTimerAlarm: vi.fn(),
}))

import { playTimerAlarm } from "@/lib/alarm"

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
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

  it("fires the alarm exactly when the countdown crosses zero", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() + 1_500} alarm />)
    expect(playTimerAlarm).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(playTimerAlarm).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Tiempo terminado")).toBeInTheDocument()
    // Further ticks must not re-fire.
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(playTimerAlarm).toHaveBeenCalledTimes(1)
  })

  it("stays silent when mounted with an already-expired countdown", () => {
    render(<PozoTimer label="Partido" endsAt={Date.now() - 5_000} alarm />)
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(playTimerAlarm).not.toHaveBeenCalled()
  })

  it("does not beep while the bell toggle is muted, and persists the choice", () => {
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
    expect(playTimerAlarm).not.toHaveBeenCalled()
  })

  it("renders no bell toggle when the alarm feature is off", () => {
    render(<PozoTimer label="Calentamiento" endsAt={Date.now() + 1_000} />)
    expect(
      screen.queryByRole("button", { name: /alarma/i }),
    ).not.toBeInTheDocument()
  })
})
