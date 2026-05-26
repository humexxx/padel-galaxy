import { Link } from "react-router"
import { ArrowRightIcon } from "lucide-react"

import { Heading } from "@/components/ui/typography"

/**
 * Hero with the same "spotlight + grid lines" treatment used in
 * trim-success and allstars-galaxy, tinted with the app's primary
 * (a muted indigo, `oklch(0.55 0.10 265)` — same value as `--primary`
 * in light mode) so the landing matches the in-app palette. We use
 * literal oklch() instead of `var(--primary)` because the landing
 * wrapper forces light mode but `next-themes` may still set `.dark`
 * on `<html>`, which would flip the var.
 *
 * Below the headline, a `FauxPozoPreview` mimics a real pozo dashboard
 * so the visitor sees the product instead of a stock illustration.
 */
export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200/80">
      {/* Soft radial spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, oklch(0.55 0.10 265 / 0.14) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      {/* Grid lines, faded to the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-24 text-center sm:px-6 sm:pt-32">
        <a
          href="#features"
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs text-zinc-600 backdrop-blur transition-colors hover:border-zinc-300 hover:text-zinc-900"
        >
          <span className="inline-block size-1.5 rounded-full bg-[oklch(0.55_0.10_265)]" />
          Pozos · Grupos · Jugadores · Historial
          <ArrowRightIcon className="size-3" />
        </a>

        <Heading level="display" className="mx-auto max-w-4xl">
          Tus pozos de pádel,
          <br />
          organizados.
        </Heading>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-zinc-500 sm:text-lg">
          Armá rondas sin parejas repetidas, cronometrá los partidos y rankeá
          automáticamente. Después mirá la evolución de cada jugador y la
          temporada completa de tu grupo.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-[14px] font-medium text-white transition hover:bg-zinc-800"
          >
            Empezar ahora
            <ArrowRightIcon className="size-4" />
          </Link>
          <a
            href="#how"
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-[14px] font-medium text-zinc-900 transition hover:bg-zinc-50"
          >
            Ver cómo funciona
          </a>
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          Sin instalar nada. Sync en la nube entre celular, tablet y desktop.
        </p>
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <FauxPozoPreview />
      </div>
    </section>
  )
}

const STANDINGS = [
  { name: "Jason", pg: 3, dif: "+8" },
  { name: "Tomás", pg: 2, dif: "+4" },
  { name: "Lucía", pg: 2, dif: "+2" },
  { name: "Mateo", pg: 1, dif: "-3" },
  { name: "Sofía", pg: 1, dif: "-5" },
  { name: "Iván", pg: 0, dif: "-6" },
]

/**
 * Static mockup of the in-app pozo view. No interactivity — pure visual
 * to give the visitor a feel for the actual product before signing up.
 */
function FauxPozoPreview() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_30px_120px_-20px_oklch(0.55_0.10_265/0.22)]">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
        {/* Browser chrome */}
        <div className="mb-6 flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="size-2 rounded-full bg-red-400" />
            <span className="size-2 rounded-full bg-yellow-400" />
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="ml-3 font-mono text-zinc-500">
              padel-galaxy.app/pozos/sabado
            </span>
          </div>
          <span className="hidden text-xs text-zinc-400 sm:inline">
            Ronda 3 de 4
          </span>
        </div>

        {/* Breadcrumb-style tag — hints at the groups feature without
            actually adding nav. */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600">
            <span className="inline-block size-1.5 rounded-full bg-zinc-400" />
            Grupo · Club Sábado
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.97_0.02_265)] px-2.5 py-1 font-medium text-[oklch(0.42_0.10_265)]">
            Balanceado
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-zinc-500 ring-1 ring-zinc-200">
            Sin parejas repetidas
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Jugadores", value: "8" },
            { label: "Canchas", value: "2" },
            { label: "Tiempo", value: "01:24" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="text-xs text-zinc-500">{kpi.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Mini standings */}
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-zinc-400">
            Tabla
          </div>
          <ul className="divide-y divide-zinc-100">
            {STANDINGS.map((p, i) => (
              <li
                key={p.name}
                className="flex items-center gap-3 px-4 py-2.5 text-sm sm:gap-4"
              >
                <span className="w-6 font-mono text-xs tabular-nums text-zinc-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate font-medium text-zinc-800">
                  {p.name}
                </span>
                <span className="w-12 text-right tabular-nums text-zinc-600">
                  {p.pg} PG
                </span>
                <span
                  className={`w-12 text-right font-mono tabular-nums ${
                    p.dif.startsWith("+")
                      ? "text-[oklch(0.5_0.10_265)]"
                      : "text-zinc-400"
                  }`}
                >
                  {p.dif}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
