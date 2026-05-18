"use client"

import Link from "next/link"
import { PlusIcon, Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PozoCard } from "@/components/pozo/pozo-card"
import { usePozos } from "@/hooks/use-pozos"

export default function PozosPage() {
  const { pozos, hydrated, remove } = usePozos()

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pozos</h1>
          <p className="text-sm text-muted-foreground">
            Organizá tus pozos de pádel, cronometrá y rankeá automáticamente.
          </p>
        </div>
        <Button asChild size="lg" className="sm:size-auto">
          <Link href="/pozos/nuevo">
            <PlusIcon className="size-4" />
            Crear pozo
          </Link>
        </Button>
      </div>

      {!hydrated ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-44 animate-pulse">
              <CardContent />
            </Card>
          ))}
        </div>
      ) : pozos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pozos.map((p) => (
            <PozoCard key={p.id} pozo={p} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Trophy className="size-7" />
        </div>
        <div>
          <p className="text-base font-semibold">Todavía no creaste ningún pozo</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Armá tu primer pozo en menos de un minuto: agregá jugadores, definí canchas y dale al
            cronómetro.
          </p>
        </div>
        <Button asChild>
          <Link href="/pozos/nuevo">
            <PlusIcon className="size-4" />
            Crear el primero
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
