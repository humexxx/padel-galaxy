"use client"

import { useParams } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PozoView } from "@/components/pozo/pozo-view"
import { usePozo } from "@/hooks/use-pozos"

export default function PozoDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const { pozo, hydrated, update } = usePozo(id)

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card className="h-64 animate-pulse">
          <CardContent />
        </Card>
      </div>
    )
  }

  if (!pozo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-lg font-semibold">Pozo no encontrado</p>
            <p className="text-sm text-muted-foreground">
              Puede que lo hayas eliminado o que estés en otro dispositivo.
            </p>
            <Button asChild>
              <Link href="/pozos">Volver a pozos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <PozoView pozo={pozo} onUpdate={update} />
}
