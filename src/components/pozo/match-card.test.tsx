// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { MatchCard } from "./match-card"
import type { Match, Player } from "@/lib/pozo/types"

const PLAYERS: Player[] = [
  { id: "p1", name: "Ana" },
  { id: "p2", name: "Bruno" },
  { id: "p3", name: "Carla" },
  { id: "p4", name: "Diego" },
]

function playerById(): Map<string, Player> {
  return new Map(PLAYERS.map((p) => [p.id, p]))
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    round: 1,
    court: 1,
    teamA: { playerA: "p1", playerB: "p2" },
    teamB: { playerA: "p3", playerB: "p4" },
    gamesA: null,
    gamesB: null,
    ...overrides,
  }
}

// We don't fake timers in this suite: userEvent+fakeTimers interactions in
// React 19 + vitest 4 are flaky, and the 400ms debounce is short enough to
// just wait on real time via `waitFor`. waitFor has a generous 5s default
// which is plenty of headroom over 400ms.

/**
 * SaveBadge always renders a hidden placeholder with the "Guardando…" text
 * so the card's width never reflows. To assert on the *active* badge we
 * need to ignore that placeholder. This helper returns the active <span>
 * only — the one without aria-hidden — or null when no save is in flight.
 */
function activeSavingBadge(): HTMLElement | null {
  // The active span is the one whose own text starts with "Guarda…" AND
  // that's NOT the invisible placeholder and NOT the wrapping aria-live
  // container. We identify the active label by the presence of `animate-in`
  // (the enter animation only the active label carries). Matches either
  // "Guardando…" (saving) or "Guardado" (just saved).
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("span"),
  )
  return (
    candidates.find(
      (el) =>
        /Guarda/.test(el.textContent ?? "") &&
        el.getAttribute("aria-hidden") !== "true" &&
        !el.className.includes("invisible") &&
        el.className.includes("animate-in"),
    ) ?? null
  )
}

describe("<MatchCard /> auto-save", () => {
  it("debounces typing and fires a single onSubmit ~400ms after the last keystroke", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <MatchCard
        match={makeMatch()}
        playerById={playerById()}
        onSubmit={onSubmit}
      />,
    )

    const teamA = screen.getByLabelText(/Games equipo A/i)
    const teamB = screen.getByLabelText(/Games equipo B/i)

    await user.type(teamA, "6")
    await user.type(teamB, "3")

    // The active "Guardando…" badge appears right after both scores are
    // filled, confirming the debounce has been armed (no save yet, pending).
    expect(activeSavingBadge()?.textContent).toMatch(/Guardando…/i)
    expect(onSubmit).not.toHaveBeenCalled()

    // Wait for the debounce to fire. Real time, real timers.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith("m1", 6, 3)
    // Indicator flips to "Guardado" briefly.
    await waitFor(() =>
      expect(activeSavingBadge()?.textContent).toMatch(/Guardado/i),
    )
  })

  it("does not save until BOTH score inputs have a value", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <MatchCard
        match={makeMatch()}
        playerById={playerById()}
        onSubmit={onSubmit}
      />,
    )

    // Only fill team A — leave team B empty.
    await user.type(screen.getByLabelText(/Games equipo A/i), "6")

    // The active indicator never appears because the score is incomplete
    // (the invisible width-reservation placeholder is fine; we ignore it).
    expect(activeSavingBadge()).toBeNull()

    // Give the (non-existent) debounce a chance to fire anyway — it should
    // never call onSubmit because the score is partial.
    await new Promise((r) => setTimeout(r, 600))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("flushes the pending save when the card unmounts", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    const { unmount } = render(
      <MatchCard
        match={makeMatch()}
        playerById={playerById()}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText(/Games equipo A/i), "5")
    await user.type(screen.getByLabelText(/Games equipo B/i), "7")

    // Debounce in flight — unmount BEFORE it fires.
    expect(onSubmit).not.toHaveBeenCalled()
    unmount()

    // Unmount cleanup should have flushed the pending save with the latest
    // values (5–7) so navigating away doesn't lose the last edit.
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith("m1", 5, 7)
  })

  it("does not re-save when the incoming match already matches local values (idempotency)", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    // The match already has 6-2 saved.
    const match = makeMatch({ gamesA: 6, gamesB: 2 })

    render(
      <MatchCard
        match={match}
        playerById={playerById()}
        onSubmit={onSubmit}
      />,
    )

    const teamA = screen.getByLabelText(/Games equipo A/i) as HTMLInputElement
    // Re-type the same value the match already has — no new save expected.
    await user.clear(teamA)
    await user.type(teamA, "6")
    await new Promise((r) => setTimeout(r, 600))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("renders a save-indicator row with a stable height even when idle (no layout shift)", () => {
    const { container } = render(
      <MatchCard
        match={makeMatch()}
        playerById={playerById()}
        onSubmit={vi.fn()}
      />,
    )

    // SaveBadge always renders a fixed-height grid container — even when idle
    // the invisible placeholder reserves the row. We can't measure pixels in
    // jsdom but we CAN verify the placeholder span exists, which is the
    // mechanism that prevents reflow when the badge appears.
    const placeholder = container.querySelector('[aria-hidden="true"]')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.textContent).toMatch(/Guardando…/i)
  })

  it("displays a read-only score view when the readOnly prop is set", () => {
    render(
      <MatchCard
        match={makeMatch({ gamesA: 4, gamesB: 6 })}
        playerById={playerById()}
        onSubmit={vi.fn()}
        readOnly
      />,
    )

    // No editable inputs are rendered in read-only mode.
    expect(screen.queryByLabelText(/Games equipo A/i)).toBeNull()
    expect(screen.queryByLabelText(/Games equipo B/i)).toBeNull()
    // Scores are still shown as plain text.
    expect(screen.getByText("4")).toBeVisible()
    expect(screen.getByText("6")).toBeVisible()
  })
})
