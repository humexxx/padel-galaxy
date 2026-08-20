// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36"

function stubUserAgent(ua: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua)
}

function stubDisplayMode(standalone: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: standalone && query.includes("standalone"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

/** Fresh module state per test — `pwa.ts` parks the event at module scope. */
async function setup() {
  vi.resetModules()
  const pwa = await import("@/lib/pwa")
  const mod = await import("@/components/install-app")
  pwa.initPwa()
  return mod
}

/** Stand-in for Chrome's non-standard BeforeInstallPromptEvent. */
function fireInstallPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  return prompt
}

beforeEach(() => {
  stubDisplayMode(false)
  stubUserAgent(ANDROID_UA)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("InstallAppButton", () => {
  it("stays hidden until the browser offers an install", async () => {
    const { InstallAppButton } = await setup()
    render(<InstallAppButton />)
    expect(
      screen.queryByRole("button", { name: "Instalar app" }),
    ).not.toBeInTheDocument()
  })

  it("appears once Chrome fires beforeinstallprompt, and triggers it on click", async () => {
    const { InstallAppButton } = await setup()
    render(<InstallAppButton />)
    const prompt = fireInstallPrompt()

    const button = screen.getByRole("button", { name: "Instalar app" })
    await userEvent.click(button)
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it("disappears after the app is installed", async () => {
    const { InstallAppButton } = await setup()
    render(<InstallAppButton />)
    fireInstallPrompt()
    expect(screen.getByRole("button", { name: "Instalar app" })).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event("appinstalled"))
    })
    expect(
      screen.queryByRole("button", { name: "Instalar app" }),
    ).not.toBeInTheDocument()
  })

  it("renders nothing when already running from the home screen", async () => {
    stubDisplayMode(true)
    const { InstallAppButton } = await setup()
    render(<InstallAppButton />)
    expect(
      screen.queryByRole("button", { name: "Instalar app" }),
    ).not.toBeInTheDocument()
  })

  it("shows Share-sheet instructions on iOS Safari, which never fires the event", async () => {
    stubUserAgent(IOS_UA)
    const { InstallAppButton } = await setup()
    render(<InstallAppButton />)

    await userEvent.click(screen.getByRole("button", { name: "Instalar app" }))
    expect(await screen.findByText("Instalar en tu iPhone")).toBeInTheDocument()
    expect(screen.getByText(/Compartir en la barra de Safari/)).toBeInTheDocument()
  })

  it("sends iOS Chrome to Safari instead of leaving a dead end", async () => {
    // Chrome on iOS genuinely cannot add to the home screen, but going
    // silent left users with no option and no explanation.
    stubUserAgent(`${IOS_UA} CriOS/126.0`)
    const { InstallAppButton } = await setup()
    render(<InstallAppButton />)

    await userEvent.click(screen.getByRole("button", { name: "Instalar app" }))
    expect(
      await screen.findByText("Abrila en Safari para instalarla"),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Copiar el link/ })).toBeInTheDocument()
  })

  it("explains the browser menu when Chromium gives us no prompt", async () => {
    // e.g. already installed, or the user dismissed the prompt once and
    // Chrome is suppressing it for months.
    vi.stubGlobal("onbeforeinstallprompt", null)
    const { InstallAppButton } = await setup()
    render(<InstallAppButton />)

    await userEvent.click(screen.getByRole("button", { name: "Instalar app" }))
    expect(
      await screen.findByText("Instalar desde el menú del navegador"),
    ).toBeInTheDocument()
  })
})

describe("InstallAppBanner", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("invites the user once the browser says it can install", async () => {
    const { InstallAppBanner } = await setup()
    render(<InstallAppBanner />)
    expect(screen.queryByText("Instalá Padel Galaxy")).not.toBeInTheDocument()

    fireInstallPrompt()
    expect(screen.getByText("Instalá Padel Galaxy")).toBeInTheDocument()
  })

  it("triggers the native prompt from its Instalar button", async () => {
    const { InstallAppBanner } = await setup()
    render(<InstallAppBanner />)
    const prompt = fireInstallPrompt()

    await userEvent.click(screen.getByRole("button", { name: "Instalar" }))
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it("stays gone once dismissed, and remembers across reloads", async () => {
    const { InstallAppBanner } = await setup()
    const { unmount } = render(<InstallAppBanner />)
    fireInstallPrompt()

    await userEvent.click(screen.getByRole("button", { name: "No mostrar más" }))
    expect(screen.queryByText("Instalá Padel Galaxy")).not.toBeInTheDocument()
    expect(window.localStorage.getItem("pg.install-banner-dismissed")).toBe("1")

    // A fresh mount is the same thing a page reload does.
    unmount()
    const again = await setup()
    render(<again.InstallAppBanner />)
    fireInstallPrompt()
    expect(screen.queryByText("Instalá Padel Galaxy")).not.toBeInTheDocument()
  })

  it("shows Share-sheet steps on iOS instead of a prompt that does not exist", async () => {
    stubUserAgent(IOS_UA)
    const { InstallAppBanner } = await setup()
    render(<InstallAppBanner />)

    await userEvent.click(screen.getByRole("button", { name: "Instalar" }))
    expect(await screen.findByText("Instalar en tu iPhone")).toBeInTheDocument()
  })

  it("renders nothing when the app is already installed", async () => {
    stubDisplayMode(true)
    const { InstallAppBanner } = await setup()
    render(<InstallAppBanner />)
    fireInstallPrompt()
    expect(screen.queryByText("Instalá Padel Galaxy")).not.toBeInTheDocument()
  })
})
