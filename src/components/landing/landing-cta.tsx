import { Link } from "react-router"
import { ArrowRightIcon } from "lucide-react"

/**
 * Closing CTA. Mirrors the hero's spotlight treatment (radial gradient
 * + emerald tint, this time anchored at the bottom) so the page opens
 * and closes with the same visual rhyme.
 */
export function LandingCta() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 100%, rgba(16,185,129,0.10) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-28">
        <h2 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Listo para armar el próximo pozo.
        </h2>
        <p className="mt-4 text-zinc-500">
          Probalo gratis. Tu primer pozo en menos de un minuto.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Empezar ahora
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
