import { Link } from "react-router"
import {
  ArrowRightIcon,
  ClockIcon,
  ShuffleIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react"

export function LandingPage() {
  return (
    <div
      className="flex min-h-svh flex-col bg-white text-zinc-900"
      data-theme="light"
      style={{ colorScheme: "light" }}
    >
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

function SiteNav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/logo-mark.png"
            alt="Padel Galaxy"
            width={36}
            height={36}
            className="rounded-full"
          />
          <span className="font-heading text-base font-bold tracking-tight text-zinc-900">
            Padel Galaxy
          </span>
        </Link>
        <Link
          to="/login"
          className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Ingresar
        </Link>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="border-b border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="flex flex-col justify-center">
          <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Pozos de pádel · Americano · Mexicano
          </p>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
            Tus pozos de pádel, organizados.
          </h1>
          <p className="mt-5 max-w-lg text-base text-zinc-600 sm:text-lg">
            Programá rondas sin parejas repetidas, cronometrá los partidos y rankeá automáticamente.
            Todo en el celular, sin papel.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Empezar ahora
              <ArrowRightIcon className="size-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            >
              Ver cómo funciona
            </a>
          </div>
          <p className="mt-6 text-xs text-zinc-500">
            Sin instalar nada. Funciona en celular y desktop.
          </p>
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-zinc-100 lg:aspect-auto">
          <img
            src="/logo-mark.png"
            alt="Padel Galaxy"
            className="absolute inset-0 h-full w-full object-contain p-8 sm:p-12"
          />
        </div>
      </div>
    </section>
  )
}

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

function FeatureGrid() {
  return (
    <section id="features" className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          Pensado para que solo te preocupes por jugar.
        </h2>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col">
              <Icon className="size-7 text-zinc-900" strokeWidth={1.75} />
              <h3 className="mt-4 text-base font-semibold text-zinc-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    n: "1",
    title: "Creá el pozo",
    body: "Definí canchas, jugadores, duración y algoritmo. Los partidos por jugador se calculan solos.",
  },
  {
    n: "2",
    title: "Calentá y arrancá",
    body: "Apretás comenzar, suena el calentamiento y la primera ronda queda lista para jugar.",
  },
  {
    n: "3",
    title: "Cargá los resultados",
    body: "Ingresás games al terminar cada partido. La siguiente ronda se arma con los resultados.",
  },
  {
    n: "4",
    title: "Mirá el podio",
    body: "Al final aparece el podio 1-2-3 y la tabla completa, lista para guardarla o compartirla.",
  },
]

function HowItWorks() {
  return (
    <section className="bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Cómo funciona
          </h2>
          <p className="max-w-md text-sm text-zinc-600">
            En cuatro pasos. No necesitás ningún conocimiento previo, solo los nombres de los
            jugadores.
          </p>
        </div>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ n, title, body }) => (
            <li key={n} className="flex flex-col gap-3 bg-white p-6 sm:p-8">
              <span className="font-mono text-2xl font-bold text-zinc-300">{n.padStart(2, "0")}</span>
              <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
              <p className="text-sm leading-relaxed text-zinc-600">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="bg-zinc-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Listo para armar el próximo pozo.
          </h2>
          <p className="mt-3 max-w-lg text-base text-zinc-300">
            Probalo gratis. Tu primer pozo en menos de un minuto.
          </p>
        </div>
        <Link
          to="/login"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
        >
          Ingresar
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <img
            src="/logo-mark.png"
            alt="Padel Galaxy"
            width={24}
            height={24}
            className="rounded-full"
          />
          <span className="text-sm font-medium text-zinc-900">Padel Galaxy</span>
        </div>
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} Padel Galaxy.
        </p>
      </div>
    </footer>
  )
}
