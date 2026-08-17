import * as React from "react"
import { DownloadIcon, PlusSquareIcon, ShareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { promptInstall, useInstallState } from "@/lib/pwa"
import { cn } from "@/lib/utils"

type Props = {
  /**
   * The landing page paints its own hardcoded light palette instead of the
   * app's theme tokens, so it passes matching zinc classes rather than
   * inheriting the ghost variant's foreground/accent colours.
   */
  className?: string
}

/**
 * "Instalar app" affordance. Renders nothing unless the browser can actually
 * install (or is iOS Safari, where the user has to do it by hand through the
 * Share sheet).
 *
 * Lives in both headers on purpose: `beforeinstallprompt` is suppressed by
 * `initPwa`, so this button is the only in-page way to install — and most
 * people meet the app logged out, on the landing.
 */
export function InstallAppButton({ className }: Props) {
  const state = useInstallState()
  const [showIosHelp, setShowIosHelp] = React.useState(false)

  if (state === "installed" || state === "hidden") return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Instalar app"
        title="Instalar Padel Galaxy en este dispositivo"
        onClick={() => {
          if (state === "ios") setShowIosHelp(true)
          else void promptInstall()
        }}
        className={cn("gap-1.5 px-2 sm:px-3", className)}
      >
        <DownloadIcon className="size-4" />
        <span className="hidden text-sm sm:inline">Instalar</span>
      </Button>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar en tu iPhone</DialogTitle>
            <DialogDescription>
              Safari no tiene un botón automático, pero son dos toques.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                1
              </span>
              <span className="flex items-center gap-1.5">
                Tocá <ShareIcon className="size-4 shrink-0" /> Compartir en la
                barra de Safari.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                2
              </span>
              <span className="flex items-center gap-1.5">
                Elegí <PlusSquareIcon className="size-4 shrink-0" /> Agregar a
                inicio.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                3
              </span>
              <span>Confirmá con Agregar. Listo, queda como una app más.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
