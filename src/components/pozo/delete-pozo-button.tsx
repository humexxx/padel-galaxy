import * as React from "react"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ResponsiveConfirm } from "@/components/ui/responsive-confirm"
import { useAuth } from "@/contexts/auth-context"
import { removePozo } from "@/lib/storage"
import type { Pozo } from "@/lib/pozo/types"

/**
 * Trash button + confirmation for a pozo. Renders nothing for someone who
 * couldn't delete it anyway (the rules allow the owner or an admin), and
 * only reports success once Firestore has accepted the delete.
 */
export function DeletePozoButton({ pozo }: { pozo: Pozo }) {
  const { user, isAdmin } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  if (!isAdmin && pozo.ownerId !== user?.uid) return null

  async function handleDelete() {
    setBusy(true)
    try {
      await removePozo(pozo.id)
      setOpen(false)
      toast.success("Pozo eliminado")
    } catch (err) {
      console.error("Error deleting pozo:", err)
      toast.error("No se pudo eliminar el pozo")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Eliminar ${pozo.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ResponsiveConfirm
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar pozo?"
        description={
          <>
            Esta acción no se puede deshacer. Se borrarán todos los partidos y
            resultados de <span className="font-medium">{pozo.name}</span>.
          </>
        }
        busy={busy}
        actions={[
          {
            label: busy ? "Eliminando…" : "Eliminar pozo",
            destructive: true,
            onSelect: handleDelete,
          },
        ]}
      />
    </>
  )
}
