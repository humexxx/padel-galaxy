const STEPS = [
  {
    n: 1,
    title: "Creá el pozo",
    body: "Definí canchas, jugadores, duración y algoritmo. Los partidos por jugador se calculan solos.",
  },
  {
    n: 2,
    title: "Calentá y arrancá",
    body: "Apretás comenzar, suena el calentamiento y la primera ronda queda lista para jugar.",
  },
  {
    n: 3,
    title: "Cargá los resultados",
    body: "Ingresás games al terminar cada partido. La siguiente ronda se arma con los resultados.",
  },
  {
    n: 4,
    title: "Mirá el podio",
    body: "Al final aparece el podio 1-2-3 y la tabla completa, lista para guardarla o compartirla.",
  },
]

export function LandingHow() {
  return (
    <section
      id="how"
      className="border-b border-zinc-200/80 bg-zinc-50 py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Cómo funciona
          </span>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            En cuatro pasos.
          </h2>
          <p className="mt-4 text-zinc-500">
            No necesitás nada más que los nombres de los jugadores.
          </p>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ n, title, body }) => (
            <li
              key={n}
              className="flex flex-col gap-3 bg-white p-6 sm:p-8"
            >
              <span className="font-mono text-xs font-medium uppercase tracking-widest text-zinc-400">
                Paso {String(n).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-medium tracking-tight text-zinc-900">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-500">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
