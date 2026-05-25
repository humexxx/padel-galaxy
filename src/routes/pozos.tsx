import { Link } from "react-router"
import { ArrowRightIcon, PlusIcon, TrophyIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PozoCard } from "@/components/pozo/pozo-card"
import { usePozos } from "@/hooks/use-pozos"

export function PozosPage() {
  const { pozos, hydrated, remove } = usePozos()
  const active = pozos.filter((p) => p.status !== "finished")

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pozos</h1>
        <p className="text-sm text-muted-foreground">
          Organizá tus pozos de pádel, cronometrá y rankeá automáticamente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CreatePozoCard />
        {!hydrated
          ? Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="h-44 p-6">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-4 w-1/2" />
                <Skeleton className="mt-3 h-4 w-1/3" />
                <Skeleton className="mt-6 h-9 w-full" />
              </Card>
            ))
          : active.map((p) => <PozoCard key={p.id} pozo={p} onDelete={remove} />)}
      </div>

      {hydrated && active.length === 0 && (
        <EmptyHint />
      )}
    </div>
  )
}

function CreatePozoCard() {
  return (
    <Link
      to="/pozos/nuevo"
      aria-label="Crear pozo"
      className="group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 text-left transition hover:border-primary hover:from-primary/15 hover:to-primary/0 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition group-hover:scale-105">
        <PlusIcon className="size-5" />
      </div>
      <div className="mt-6">
        <p className="text-lg font-semibold leading-tight text-foreground">
          Crear pozo
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Empezá uno nuevo en menos de un minuto.
        </p>
      </div>
      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        Empezar
        <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

function EmptyHint() {
  return (
    <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <TrophyIcon className="size-6" />
      </div>
      <p className="text-base font-semibold">Todavía no tenés pozos activos</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Usá la card de la izquierda para crear el primero. Cuando termines uno, va a aparecer en{" "}
        <Link to="/historial" className="font-medium text-foreground underline-offset-4 hover:underline">
          Historial
        </Link>
        .
      </p>
    </div>
  )
}
