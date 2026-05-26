// @vitest-environment jsdom
import * as React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PlayerCombobox, type PlayerSelection } from "./player-combobox"
import { normalizeName, type PlayerRecord } from "@/lib/players"

function makePlayer(name: string, overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    id: `id-${name}`,
    ownerId: "owner-1",
    name,
    nameLower: normalizeName(name),
    linkedUid: null,
    invitedEmail: null,
    invitedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const ROSTER: PlayerRecord[] = [
  makePlayer("Ana"),
  makePlayer("Jason Hume"),
  makePlayer("José Ramón", { linkedUid: "uid-jose" }),
  makePlayer("María"),
  makePlayer("Bruno"),
]

type HarnessProps = {
  initial?: PlayerSelection
  excludeIds?: Set<string>
  players?: PlayerRecord[]
  label?: string
}

function Harness({
  initial = { id: null, name: "" },
  excludeIds,
  players = ROSTER,
  label = "Jugador 1",
}: HarnessProps) {
  const [value, setValue] = React.useState<PlayerSelection>(initial)
  return (
    <div>
      <PlayerCombobox
        value={value}
        onChange={setValue}
        players={players}
        excludeIds={excludeIds}
        label={label}
      />
      <output data-testid="echo">{`${value.id ?? "null"}|${value.name}`}</output>
    </div>
  )
}

async function openPopover(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: label }))
}

describe("<PlayerCombobox>", () => {
  it("renders the placeholder when value is empty", () => {
    render(<Harness label="Jugador 1" />)
    expect(screen.getByText("Buscar o crear…")).toBeInTheDocument()
  })

  it("opens a popover with the roster on click", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openPopover(user, "Jugador 1")

    const list = await screen.findByRole("listbox")
    expect(within(list).getByText("Ana")).toBeInTheDocument()
    expect(within(list).getByText("Jason Hume")).toBeInTheDocument()
    expect(within(list).getByText("José Ramón")).toBeInTheDocument()
  })

  it("shows the 'vinculado' badge for players that have linkedUid", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openPopover(user, "Jugador 1")

    const joseRow = (await screen.findByText("José Ramón")).closest('[role="option"]')!
    expect(within(joseRow as HTMLElement).getByText(/vinculado/i)).toBeInTheDocument()
  })

  it("filters suggestions as you type (case + tilde insensitive)", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openPopover(user, "Jugador 1")

    const input = screen.getByPlaceholderText(/buscar/i)
    await user.type(input, "jose")

    expect(await screen.findByText("José Ramón")).toBeInTheDocument()
    expect(screen.queryByText("Ana")).not.toBeInTheDocument()
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument()
  })

  it("picking an existing player emits {id, name}", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openPopover(user, "Jugador 1")

    await user.click(await screen.findByText("Jason Hume"))

    expect(screen.getByTestId("echo")).toHaveTextContent(`id-Jason Hume|Jason Hume`)
  })

  it("offers a 'Crear «X»' affordance when the typed name doesn't match", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openPopover(user, "Jugador 1")

    const input = screen.getByPlaceholderText(/buscar/i)
    await user.type(input, "Carla")

    const createRow = await screen.findByText(/Crear "Carla"/i)
    expect(createRow).toBeInTheDocument()
  })

  it("does NOT show the create affordance when the typed name matches an existing player", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openPopover(user, "Jugador 1")

    const input = screen.getByPlaceholderText(/buscar/i)
    // Even tilde-insensitive match — typing "jose ramon" matches "José Ramón".
    await user.type(input, "jose ramon")

    expect(await screen.findByText("José Ramón")).toBeInTheDocument()
    expect(screen.queryByText(/Crear "/i)).not.toBeInTheDocument()
  })

  it("creating a new player emits {id: null, name: trimmed}", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openPopover(user, "Jugador 1")

    const input = screen.getByPlaceholderText(/buscar/i)
    await user.type(input, "  Carla  ")

    await user.click(await screen.findByText(/Crear /i))

    expect(screen.getByTestId("echo")).toHaveTextContent(`null|Carla`)
  })

  it("hides IDs that appear in excludeIds (those are picked in other slots)", async () => {
    const user = userEvent.setup()
    const exclude = new Set(["id-Ana", "id-Bruno"])
    render(<Harness excludeIds={exclude} />)
    await openPopover(user, "Jugador 1")

    await screen.findByText("Jason Hume") // sentinel — list rendered
    expect(screen.queryByText("Ana")).not.toBeInTheDocument()
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument()
  })

  it("keeps the CURRENT selection visible even when its id is in excludeIds", async () => {
    const user = userEvent.setup()
    const ana = ROSTER.find((p) => p.name === "Ana")!
    // Simulate: this slot has Ana picked AND the parent passed her id in
    // excludeIds (parent isn't being precise) — we should still see her so
    // the user can confirm or change.
    const exclude = new Set([ana.id])
    render(
      <Harness
        initial={{ id: ana.id, name: ana.name }}
        excludeIds={exclude}
      />,
    )
    await openPopover(user, "Jugador 1")

    // The trigger already shows "Ana" because she's the selected value,
    // so we scope to the listbox to assert the SUGGESTION row is there too.
    const listbox = await screen.findByRole("listbox")
    expect(within(listbox).getByText("Ana")).toBeInTheDocument()
  })

  it("shows the 'nuevo' badge on the trigger when id is null and name is filled", () => {
    render(<Harness initial={{ id: null, name: "Carla" }} />)
    expect(screen.getByText(/^nuevo$/i)).toBeInTheDocument()
    expect(screen.getByText("Carla")).toBeInTheDocument()
  })

  it("does NOT show the 'nuevo' badge for existing players", () => {
    const ana = ROSTER.find((p) => p.name === "Ana")!
    render(<Harness initial={{ id: ana.id, name: ana.name }} />)
    expect(screen.queryByText(/^nuevo$/i)).not.toBeInTheDocument()
  })
})
