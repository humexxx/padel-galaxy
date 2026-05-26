// @vitest-environment jsdom
import * as React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { GroupMultiSelect } from "./group-multi-select"
import { normalizeName } from "@/lib/players"
import type { GroupRecord } from "@/lib/groups"

function makeGroup(name: string): GroupRecord {
  return {
    id: `g-${name.toLowerCase().replace(/\s+/g, "-")}`,
    ownerId: "owner-1",
    name,
    nameLower: normalizeName(name),
    createdAt: 0,
    updatedAt: 0,
  }
}

const GROUPS: GroupRecord[] = [
  makeGroup("Lunes"),
  makeGroup("Miércoles"),
  makeGroup("Viernes"),
  makeGroup("Sábado AM"),
]

/**
 * Controlled wrapper that surfaces the Set<string> value so assertions can
 * inspect it. Keeps the test focused on UX behavior rather than parent state.
 */
function Harness({ initial = new Set<string>() }: { initial?: Set<string> }) {
  const [value, setValue] = React.useState<ReadonlySet<string>>(initial)
  return (
    <div>
      <GroupMultiSelect groups={GROUPS} value={value} onChange={setValue} />
      <output data-testid="selected">
        {Array.from(value).sort().join(",") || "<empty>"}
      </output>
    </div>
  )
}

describe("<GroupMultiSelect />", () => {
  it("starts in the 'all groups' state when no selection", () => {
    render(<Harness />)
    // Trigger label reflects the empty / 'all' semantic — placeholder text.
    expect(screen.getByRole("button", { name: /Todos los grupos/i })).toBeVisible()
    expect(screen.getByTestId("selected").textContent).toBe("<empty>")
  })

  it("toggles a single group and shows it as a chip + single-name label", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole("button", { name: /Todos los grupos/i }))

    const listbox = await screen.findByRole("listbox")
    await user.click(within(listbox).getByText("Lunes"))

    // Trigger label flips to the single picked name.
    expect(screen.getByRole("button", { name: /^Lunes$/ })).toBeVisible()
    // Chip with X-button appears for the picked group.
    expect(screen.getByRole("button", { name: /Quitar Lunes/i })).toBeVisible()
    expect(screen.getByTestId("selected").textContent).toBe("g-lunes")
  })

  it("supports multi-select; trigger label collapses to 'N grupos' once >1 picked", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole("button", { name: /Todos los grupos/i }))
    const listbox = await screen.findByRole("listbox")
    await user.click(within(listbox).getByText("Lunes"))
    await user.click(within(listbox).getByText("Viernes"))

    // 2 groups → label becomes "2 grupos".
    expect(screen.getByRole("button", { name: /2 grupos/i })).toBeVisible()
    expect(screen.getByTestId("selected").textContent).toBe("g-lunes,g-viernes")
  })

  it("removes a single chip without affecting the rest", async () => {
    const user = userEvent.setup()
    render(<Harness initial={new Set(["g-lunes", "g-viernes"])} />)

    // Remove the "Lunes" chip — "Viernes" should remain.
    await user.click(screen.getByRole("button", { name: /Quitar Lunes/i }))
    expect(screen.getByTestId("selected").textContent).toBe("g-viernes")
    // Now showing the single remaining name.
    expect(screen.getByRole("button", { name: /^Viernes$/ })).toBeVisible()
  })

  it("filters group rows by normalized search (accent + case insensitive)", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: /Todos los grupos/i }))

    // Type "miercoles" (no accent) — should still match "Miércoles".
    const input = screen.getByPlaceholderText(/Buscar grupo/i)
    await user.type(input, "miercoles")

    const listbox = await screen.findByRole("listbox")
    expect(within(listbox).getByText("Miércoles")).toBeVisible()
    expect(within(listbox).queryByText("Lunes")).toBeNull()
    expect(within(listbox).queryByText("Viernes")).toBeNull()
  })

  it("shows an empty state when no group matches", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: /Todos los grupos/i }))

    await user.type(screen.getByPlaceholderText(/Buscar grupo/i), "zzzzz")

    expect(await screen.findByText(/Sin grupos que coincidan/i)).toBeVisible()
  })

  it("exposes a 'Limpiar selección' action that wipes the Set back to empty", async () => {
    const user = userEvent.setup()
    render(<Harness initial={new Set(["g-lunes", "g-viernes"])} />)

    await user.click(screen.getByRole("button", { name: /2 grupos/i }))
    const listbox = await screen.findByRole("listbox")
    await user.click(within(listbox).getByText(/Limpiar selección/i))

    // Back to "all groups" state + popover auto-closed.
    expect(screen.getByRole("button", { name: /Todos los grupos/i })).toBeVisible()
    expect(screen.getByTestId("selected").textContent).toBe("<empty>")
  })
})
