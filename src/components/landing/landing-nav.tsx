import { Link } from "react-router"
import { ArrowRightIcon } from "lucide-react"

const NAV_LINKS = [
  { label: "Producto", href: "#features" },
  { label: "Cómo funciona", href: "#how" },
]

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-900"
          >
            <img
              src="/favicon.svg"
              alt=""
              width={24}
              height={24}
              className="select-none"
            />
            Padel Galaxy
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <Link
          to="/login"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-zinc-900 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-800"
        >
          Ingresar
          <ArrowRightIcon className="!size-3" />
        </Link>
      </div>
    </header>
  )
}
