import { LogoMark } from "@/components/brand-logo"

export function LandingFooter() {
  return (
    <footer className="bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <LogoMark className="size-6" />
          <span className="text-sm font-medium text-zinc-900">
            Padel Galaxy
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} Padel Galaxy.
        </p>
      </div>
    </footer>
  )
}
