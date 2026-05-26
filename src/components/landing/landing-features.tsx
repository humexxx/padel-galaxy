import {
  ClockIcon,
  ShuffleIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react"

import { Heading } from "@/components/ui/typography"

const FEATURES = [
  {
    icon: ShuffleIcon,
    title: "Sin parejas repetidas",
    body: "El algoritmo arma cada ronda con round-robin: vas a jugar con todos antes de repetir compañero.",
  },
  {
    icon: ClockIcon,
    title: "Cronómetro en pantalla",
    body: "Calentamiento + tiempo total por partido visibles en grande. Nadie se queda mirando el reloj.",
  },
  {
    icon: TrophyIcon,
    title: "Tabla y podio automáticos",
    body: "Cargás games por partido y la tabla se ordena sola: estilo fútbol (PG → H2H → DIF) o por games.",
  },
  {
    icon: UsersIcon,
    title: "Hasta 32 jugadores",
    body: "Soporta rotación si tenés más jugadores que canchas. Todos juegan la misma cantidad de partidos.",
  },
]

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="border-b border-zinc-200/80 bg-white py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Producto
          </span>
          <Heading level="h2" className="mt-3 text-zinc-900">
            Pensado para que solo te preocupes por jugar.
          </Heading>
        </div>

        {/* Single 1px gap creates clean dividers between cards without
            multiple borders stacking up. */}
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group relative bg-white p-6 transition-colors hover:bg-zinc-50 sm:p-8"
            >
              <div className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 transition-colors group-hover:border-zinc-300 group-hover:text-zinc-900">
                <Icon className="size-4" />
              </div>
              <h3 className="text-lg font-medium tracking-tight text-zinc-900">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
