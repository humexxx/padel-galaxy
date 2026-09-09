import * as React from "react"
import { Link } from "react-router"
import { CalendarIcon, Trash2Icon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResponsiveConfirm } from "@/components/ui/responsive-confirm"
import { PozoStatusBadge } from "@/components/pozo/status-badge"
import { formatRelative } from "@/lib/time"
import type { Pozo } from "@/lib/pozo/types"

type Props = {
  pozo: Pozo
  onDelete: (id: string) => void
}

export function PozoCard({ pozo, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  return (
    <Card className="group transition hover:border-primary/40 hover:shadow-md">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{pozo.name}</CardTitle>
          <PozoStatusBadge status={pozo.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <UsersIcon className="size-4" />
          <span>
            {pozo.players.length} jugadores · {pozo.config.courts} canchas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4" />
          <span>{formatRelative(pozo.createdAt)}</span>
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link to={`/pozos/${pozo.id}`}>
            {pozo.status === "draft"
              ? "Iniciar"
              : pozo.status === "finished"
                ? "Ver resultados"
                : "Continuar"}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Eliminar pozo"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2Icon className="size-4" />
        </Button>
        <ResponsiveConfirm
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="¿Eliminar pozo?"
          description={
            <>
              Esta acción no se puede deshacer. Se borrarán todos los partidos y
              resultados de <span className="font-medium">{pozo.name}</span>.
            </>
          }
          actions={[
            {
              label: "Eliminar pozo",
              destructive: true,
              onSelect: () => {
                setConfirmOpen(false)
                onDelete(pozo.id)
                toast.success("Pozo eliminado")
              },
            },
          ]}
        />
      </CardFooter>
    </Card>
  )
}
