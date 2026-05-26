import { Link } from "react-router"
import { ArrowRightIcon } from "lucide-react"

/**
 * Hero with the same "spotlight + grid lines" treatment used in
 * trim-success and allstars-galaxy, tinted emerald to nod at the padel
 * court palette. Below the headline, a `FauxPozoPreview` mimics a real
 * pozo dashboard so the visitor sees the product instead of a stock
 * illustration.
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
            "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.12) 0%, rgba(255,255,255,0) 70%)",
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
          <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
          Pozos de pádel · Americano · Mexicano
          <ArrowRightIcon className="size-3" />
        </a>

        <h1 className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Tus pozos de pádel,
          <br />
          organizados.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-zinc-500 sm:text-lg">
          Programá rondas sin parejas repetidas, cronometrá los partidos y
          rankeá automáticamente. Todo en el celular, sin papel.
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
          Sin instalar nada. Funciona en celular y desktop.
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
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_30px_120px_-20px_rgba(16,185,129,0.18)]">
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
                      ? "text-emerald-600"
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
