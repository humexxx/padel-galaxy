import { Link, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageContainer } from "@/components/page-container"
import { PozoView } from "@/components/pozo/pozo-view"
import { usePozo } from "@/hooks/use-pozos"

export function PozoDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { pozo, hydrated, update } = usePozo(id)

  if (!hydrated) {
    return (
      <PageContainer>
        <Card className="h-64 animate-pulse">
          <CardContent />
        </Card>
      </PageContainer>
    )
  }

  if (!pozo) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-lg font-semibold">Pozo no encontrado</p>
            <p className="text-sm text-muted-foreground">
              Puede que lo hayas eliminado o que no tengas acceso.
            </p>
            <Button asChild>
              <Link to="/pozos">Volver a pozos</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return <PozoView pozo={pozo} onUpdate={update} />
}
