import { Link } from "react-router"
import { CalendarIcon, UsersIcon } from "lucide-react"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeletePozoButton } from "@/components/pozo/delete-pozo-button"
import { PozoStatusBadge } from "@/components/pozo/status-badge"
import { formatRelative } from "@/lib/time"
import type { Pozo } from "@/lib/pozo/types"

export function PozoCard({ pozo }: { pozo: Pozo }) {
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
        <DeletePozoButton pozo={pozo} />
      </CardFooter>
    </Card>
  )
}
