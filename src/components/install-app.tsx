import * as React from "react"
import {
  DownloadIcon,
  PlusSquareIcon,
  ShareIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useInstallAction } from "@/hooks/use-install-action"
import {
  setInstallBannerDismissed,
  useInstallBannerDismissed,
} from "@/lib/preferences"
import { useInstallState } from "@/lib/pwa"
import { cn } from "@/lib/utils"

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {n}
      </span>
      <span className="flex items-center gap-1.5">{children}</span>
    </li>
  )
}

export function IosInstructions({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Instalar en tu iPhone</DialogTitle>
          <DialogDescription>
            Safari no tiene un botón automático, pero son dos toques.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            Tocá <ShareIcon className="size-4 shrink-0" /> Compartir en la barra
            de Safari.
          </Step>
          <Step n={2}>
            Elegí <PlusSquareIcon className="size-4 shrink-0" /> Agregar a
            inicio.
          </Step>
          <Step n={3}>
            <span>Confirmá con Agregar. Listo, queda como una app más.</span>
          </Step>
        </ol>
      </DialogContent>
    </Dialog>
  )
}

type ButtonProps = {
  /**
   * The landing page paints its own hardcoded light palette instead of the
   * app's theme tokens, so it passes matching zinc classes rather than
   * inheriting the ghost variant's foreground/accent colours.
   */
  className?: string
}

/**
 * Persistent, low-key install entry point — the "simple promotion" pattern.
 * Renders nothing unless the browser can actually install (or is iOS Safari,
 * where the user has to do it by hand through the Share sheet).
 */
export function InstallAppButton({ className }: ButtonProps) {
  const state = useInstallState()
  const { trigger, showIosHelp, setShowIosHelp } = useInstallAction(state)

  if (state === "installed" || state === "hidden") return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Instalar app"
        title="Instalar Padel Galaxy en este dispositivo"
        onClick={trigger}
        className={cn("gap-1.5 px-2 sm:px-3", className)}
      >
        <DownloadIcon className="size-4" />
        <span className="hidden text-sm sm:inline">Instalar</span>
      </Button>
      <IosInstructions open={showIosHelp} onOpenChange={setShowIosHelp} />
    </>
  )
}

/**
 * Phone-sized install promotion. The app header runs out of room well before
 * a 390px viewport, so on phones the invitation moves out of the chrome and
 * into a dismissible bar pinned above the fold's bottom edge.
 *
 * Deliberately NOT a modal: an interstitial that blocks the app is the
 * "aggressive" pattern, and it costs more engagement than it wins installs.
 * Dismissal is permanent (see `useInstallBannerDismissed`); the user menu
 * keeps the door open afterwards.
 */
export function InstallAppBanner() {
  const state = useInstallState()
  const dismissed = useInstallBannerDismissed()
  const { trigger, showIosHelp, setShowIosHelp } = useInstallAction(state)

  if (dismissed || state === "installed" || state === "hidden") return null

  return (
    <>
      <div
        // sm:hidden — above this width the header button is visible and a
        // banner would just be a second ask for the same thing.
        className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:hidden"
        role="region"
        aria-label="Instalar la app"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <DownloadIcon className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            Instalá Padel Galaxy
          </p>
          <p className="text-xs text-muted-foreground">
            Queda como una app, sin barra del navegador.
          </p>
        </div>
        <Button size="sm" onClick={trigger} className="shrink-0">
          Instalar
        </Button>
        <button
          type="button"
          onClick={() => setInstallBannerDismissed(true)}
          aria-label="No mostrar más"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <IosInstructions open={showIosHelp} onOpenChange={setShowIosHelp} />
    </>
  )
}
