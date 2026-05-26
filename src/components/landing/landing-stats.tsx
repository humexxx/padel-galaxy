import {
  ChartLineIcon,
  FolderKanbanIcon,
  UserPlusIcon,
} from "lucide-react"

import { Heading } from "@/components/ui/typography"

/**
 * "Más allá del partido" section. Sits between How and CTA and is the
 * deep-dive for the cross-pozo features (groups, per-player history,
 * invites) — the things that distinguish Padel Galaxy from a one-off
 * round-robin generator.
 *
 * Layout: 2-column split with a faux line chart on the right (static
 * SVG, no recharts on the landing — keeps the bundle thin) and three
 * supporting callouts below.
 */
export function LandingStats() {
  return (
    <section
      id="stats"
      className="border-b border-zinc-200/80 bg-white py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Más allá del partido
            </span>
            <Heading level="h2" className="mt-3 text-zinc-900">
              El historial completo de cada jugador.
            </Heading>
            <p className="mt-4 text-zinc-500">
              Cada pozo cerrado se suma al perfil de los jugadores. Mirás
              cómo evolucionan en games, partidos ganados, puntos y
              posición final pozo a pozo — filtrando por grupo y por
              rango de fechas.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <div className="font-medium text-zinc-900">{title}</div>
                    <p className="mt-0.5 text-zinc-500">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <FauxHistoryChart />
        </div>
      </div>
    </section>
  )
}

const HIGHLIGHTS = [
  {
    icon: FolderKanbanIcon,
    title: "Grupos para organizar la temporada",
    body: "Club Sábado, Liga del barrio, Pretemporada… cada grupo tiene su propia tabla acumulada y gráfico mensual.",
  },
  {
    icon: ChartLineIcon,
    title: "Gráficos por métrica",
    body: "Cambiás entre games, partidos y puntos. La posición final se superpone para ver tendencias reales.",
  },
  {
    icon: UserPlusIcon,
    title: "Invitaciones por email",
    body: "Los jugadores se registran con un link y ven su propia evolución desde su cuenta.",
  },
]

/**
 * Static SVG line chart — 3 players over 8 pozos. Deliberately not
 * recharts: this is decorative, server-rendered HTML beats a JS
 * library that would only render after hydration.
 *
 * Coords run on a 360×180 viewbox (rendering-svg-precision: keep them
 * round). Values are pre-computed module-level constants.
 */
function FauxHistoryChart() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_30px_120px_-20px_oklch(0.55_0.10_265/0.22)]">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Historial · Jason
            </div>
            <div className="mt-1 text-base font-medium text-zinc-900">
              Games por pozo
            </div>
          </div>
          <div className="flex gap-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400">
            <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-zinc-200">
              7d
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-zinc-200">
              30d
            </span>
            <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-white">
              90d
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-zinc-200">
              Todo
            </span>
          </div>
        </div>

        <svg
          viewBox="0 0 360 180"
          className="h-44 w-full"
          role="img"
          aria-label="Gráfico de ejemplo: evolución de games por pozo"
        >
          {/* Horizontal grid */}
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1="0"
              x2="360"
              y1={20 + i * 40}
              y2={20 + i * 40}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="1"
            />
          ))}

          {/* Faded area under main line */}
          <path d={AREA_PATH} fill="url(#area-grad)" />

          {/* Secondary line — partidos */}
          <path
            d={LINE_PARTIDOS}
            fill="none"
            stroke="rgba(0,0,0,0.18)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Main line — games */}
          <path
            d={LINE_GAMES}
            fill="none"
            stroke="oklch(0.55 0.10 265)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points on main line */}
          {GAMES_POINTS.map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="3"
              fill="white"
              stroke="oklch(0.55 0.10 265)"
              strokeWidth="2"
            />
          ))}

          <defs>
            <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.55 0.10 265)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="oklch(0.55 0.10 265)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="mt-4 flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-zinc-700">
            <span className="inline-block h-0.5 w-4 rounded bg-[oklch(0.55_0.10_265)]" />
            Games
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            <span className="inline-block h-0.5 w-4 rounded border-t border-dashed border-zinc-400" />
            Partidos
          </span>
          <span className="ml-auto font-mono tabular-nums text-zinc-400">
            8 pozos · Club Sábado
          </span>
        </div>
      </div>
    </div>
  )
}

// Hoisted SVG path constants — static decoration, no reason to recompute
// per render. Coords on a 360×180 viewBox.
const GAMES_POINTS: ReadonlyArray<readonly [number, number]> = [
  [20, 120],
  [70, 90],
  [120, 100],
  [170, 70],
  [220, 80],
  [270, 50],
  [320, 60],
  [350, 40],
]

const LINE_GAMES =
  "M20 120 L70 90 L120 100 L170 70 L220 80 L270 50 L320 60 L350 40"

const AREA_PATH =
  "M20 120 L70 90 L120 100 L170 70 L220 80 L270 50 L320 60 L350 40 L350 160 L20 160 Z"

const LINE_PARTIDOS =
  "M20 140 L70 130 L120 120 L170 110 L220 100 L270 95 L320 85 L350 80"
