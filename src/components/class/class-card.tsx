import {
  BanIcon,
  CalendarArrowUpIcon,
  CircleCheckIcon,
  MapPinIcon,
  MoreVerticalIcon,
  PencilIcon,
  RotateCcwIcon,
  StickyNoteIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatTime,
  packageLabel,
  sessionLabel,
  setClassStatus,
  studentsLabel,
  type ClassRecord,
} from "@/lib/classes"
import { cn } from "@/lib/utils"

type Props = {
  record: ClassRecord
  onEdit: (record: ClassRecord) => void
  onRequestDelete: (record: ClassRecord) => void
  /** Hand this class — or its whole package — to the device calendar. */
  onAddToCalendar: (record: ClassRecord, wholePackage: boolean) => void
}

export function ClassCard({
  record,
  onEdit,
  onRequestDelete,
  onAddToCalendar,
}: Props) {
  const done = record.status === "done"
  const cancelled = record.status === "cancelled"
  const session = sessionLabel(record)

  async function changeStatus(
    status: ClassRecord["status"],
    message: string,
  ) {
    try {
      await setClassStatus(record.id, status)
      toast.success(message)
    } catch (err) {
      console.error("Error updating class status:", err)
      toast.error("No se pudo actualizar la clase")
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors",
        cancelled && "opacity-60",
        done && "border-primary/30 bg-primary/[0.03]",
      )}
    >
      {/* Time rail — fixed width so every row in a day lines up. */}
      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            cancelled && "line-through",
          )}
        >
          {formatTime(record.startsAt)}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {record.durationMin} min
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-1.5">
          <UsersIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-snug font-medium">
            {studentsLabel(record.students)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[11px]">
            {packageLabel(record.packageType)}
          </Badge>
          {session && (
            <Badge variant="secondary" className="text-[11px]">
              {session}
            </Badge>
          )}
          {done && (
            <Badge variant="default" className="text-[11px]">
              <CircleCheckIcon />
              Dada
            </Badge>
          )}
          {cancelled && (
            <Badge variant="destructive" className="text-[11px]">
              Cancelada
            </Badge>
          )}
        </div>

        {record.location && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{record.location}</span>
          </p>
        )}
        {record.notes && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <StickyNoteIcon className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{record.notes}</span>
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              // Tapped one-handed while the organizer is on court: 44 px
              // on touch, back to the compact 36 px where a pointer runs.
              className="size-11 shrink-0 sm:size-9"
              aria-label={`Acciones de la clase de ${studentsLabel(record.students)}`}
            />
          }
        >
          <MoreVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          {done ? (
            <DropdownMenuItem
              onClick={() =>
                changeStatus("scheduled", "Clase marcada como pendiente")
              }
            >
              <RotateCcwIcon className="size-4" />
              Marcar como pendiente
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => changeStatus("done", "Clase marcada como dada")}
            >
              <CircleCheckIcon className="size-4" />
              Marcar como dada
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onEdit(record)}>
            <PencilIcon className="size-4" />
            Editar
          </DropdownMenuItem>
          {cancelled ? (
            <DropdownMenuItem
              onClick={() => changeStatus("scheduled", "Clase reactivada")}
            >
              <RotateCcwIcon className="size-4" />
              Reactivar clase
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => changeStatus("cancelled", "Clase cancelada")}
            >
              <BanIcon className="size-4" />
              Cancelar clase
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {!cancelled && (
            <DropdownMenuItem onClick={() => onAddToCalendar(record, false)}>
              <CalendarArrowUpIcon className="size-4" />
              Agregar al calendario
            </DropdownMenuItem>
          )}
          {record.sessionCount > 1 && (
            <DropdownMenuItem onClick={() => onAddToCalendar(record, true)}>
              <CalendarArrowUpIcon className="size-4" />
              Agregar el paquete ({record.sessionCount} clases)
            </DropdownMenuItem>
          )}
          {(!cancelled || record.sessionCount > 1) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onRequestDelete(record)}
          >
            <Trash2Icon className="size-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
