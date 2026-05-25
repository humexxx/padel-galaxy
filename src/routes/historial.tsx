import { Link } from "react-router"
import { ClockIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PozoCard } from "@/components/pozo/pozo-card"
import { usePozos } from "@/hooks/use-pozos"

export function HistorialPage() {
  const { pozos, hydrated, remove } = usePozos()
  const finished = pozos
    .filter((p) => p.status === "finished")
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Historial</h1>
        <p className="text-sm text-muted-foreground">
          Tus pozos finalizados. {finished.length > 0 && `${finished.length} en total.`}
        </p>
      </div>

      {!hydrated ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-44 p-6">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-3 h-4 w-1/3" />
              <Skeleton className="mt-6 h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : finished.length === 0 ? (
        <EmptyHistorial />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {finished.map((p) => (
            <PozoCard key={p.id} pozo={p} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyHistorial() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-14 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <ClockIcon className="size-6" />
      </div>
      <p className="text-base font-semibold">Sin pozos finalizados</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Cuando termines un pozo va a aparecer acá con el podio y la tabla final.{" "}
        <Link
          to="/pozos"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Ir a Pozos
        </Link>
        .
      </p>
    </div>
  )
}
