import { Badge } from "@/components/ui/badge"
import type { PozoStatus } from "@/lib/pozo/types"

const STATUS_LABELS: Record<PozoStatus, string> = {
  draft: "Pendiente",
  warmup: "Calentamiento",
  playing: "En juego",
  finished: "Finalizado",
}

const STATUS_VARIANTS: Record<PozoStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  warmup: "secondary",
  playing: "default",
  finished: "secondary",
}

export function PozoStatusBadge({ status }: { status: PozoStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className="capitalize">
      {STATUS_LABELS[status]}
    </Badge>
  )
}
