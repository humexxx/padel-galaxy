import {
  ChartLineIcon,
  ClockIcon,
  CloudIcon,
  FolderKanbanIcon,
  ScaleIcon,
  ShuffleIcon,
  TrophyIcon,
  UserPlusIcon,
} from "lucide-react"

import { Heading } from "@/components/ui/typography"

/**
 * Eight features in a 2×4 grid (4×1 on lg). Covers the full surface of
 * the app — not just the single-pozo flow — so the landing reflects
 * what's actually in the product: groups, per-player history, cloud
 * sync, multiple algorithms, invites.
 */
const FEATURES = [
  {
    icon: ShuffleIcon,
    title: "Sin parejas repetidas",
    body: "El algoritmo arma cada ronda con round-robin: jugás con todos antes de repetir compañero.",
  },
  {
    icon: ScaleIcon,
    title: "Tres algoritmos",
    body: "Balanceado, snake o aleatorio. Elegís cómo se arman los equipos según el grupo.",
  },
  {
    icon: ClockIcon,
    title: "Cronómetro + calentamiento",
    body: "Tiempo de calentamiento y total por partido en pantalla grande, en cuenta regresiva.",
  },
  {
    icon: TrophyIcon,
    title: "Podio con confetti",
    body: "Tabla ordenable por games, partidos o puntos. Al cerrar el pozo, podio 1-2-3 con confeti.",
  },
  {
    icon: FolderKanbanIcon,
    title: "Pozos por grupo",
    body: "Agrupá pozos por club, temporada o liga. Mirá estadísticas combinadas y evolución mensual.",
  },
  {
    icon: ChartLineIcon,
    title: "Historial por jugador",
    body: "Cada jugador tiene su perfil con games, partidos ganados, puntos y posición final pozo a pozo.",
  },
  {
    icon: UserPlusIcon,
    title: "Invitá a tus jugadores",
    body: "Mandales un email. Cuando aceptan, ven su propia evolución desde su cuenta.",
  },
  {
    icon: CloudIcon,
    title: "Sync en la nube",
    body: "Todo se guarda en tiempo real. Cargás un resultado en el celular y aparece al toque en la tablet.",
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
          <p className="mt-4 text-zinc-500">
            Desde armar el primer partido hasta mirar la evolución del grupo a
            lo largo de la temporada.
          </p>
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
