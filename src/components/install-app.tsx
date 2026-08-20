import * as React from "react"
import {
  CompassIcon,
  CopyIcon,
  DownloadIcon,
  MoreVerticalIcon,
  PlusSquareIcon,
  ShareIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

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
import { useInstallState, type InstallState } from "@/lib/pwa"
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

/**
 * Best-effort jump to Safari. `x-safari-https:` is an undocumented scheme
 * Chrome on iOS hands off to the system, which routes it to Safari. Apple
 * publishes no supported way to do this, so it may silently do nothing —
 * which is why the dialog stays open behind it with the copy-link fallback
 * still on screen.
 */
function openInSafari() {
  const { host, pathname, search } = window.location
  window.location.href = `x-safari-https://${host}${pathname}${search}`
}

async function copyAppUrl() {
  try {
    await navigator.clipboard.writeText(window.location.origin)
    toast.success("Link copiado — pegalo en Safari")
  } catch {
    toast.error("No se pudo copiar. El link es " + window.location.host)
  }
}

/**
 * Whatever the browser can't do for the user, spell out. Every state that
 * isn't a one-tap install lands here rather than showing nothing.
 */
export function InstallInstructions({
  state,
  open,
  onOpenChange,
}: {
  state: InstallState
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {state === "ios" && (
          <>
            <DialogHeader>
              <DialogTitle>Instalar en tu iPhone</DialogTitle>
              <DialogDescription>
                Safari no tiene un botón automático, pero son dos toques.
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm">
              <Step n={1}>
                Tocá <ShareIcon className="size-4 shrink-0" /> Compartir en la
                barra de Safari.
              </Step>
              <Step n={2}>
                Elegí <PlusSquareIcon className="size-4 shrink-0" /> Agregar a
                inicio.
              </Step>
              <Step n={3}>
                <span>Confirmá con Agregar. Listo, queda como una app más.</span>
              </Step>
            </ol>
          </>
        )}

        {state === "ios-other" && (
          <>
            <DialogHeader>
              <DialogTitle>Abrila en Safari para instalarla</DialogTitle>
              <DialogDescription>
                iOS solo le permite a Safari agregar apps a la pantalla de
                inicio. No es un límite de Padel Galaxy: ningún navegador puede
                hacerlo en iPhone.
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm">
              <Step n={1}>Abrí este mismo link en Safari.</Step>
              <Step n={2}>
                Ahí tocá <ShareIcon className="size-4 shrink-0" /> Compartir →{" "}
                <PlusSquareIcon className="size-4 shrink-0" /> Agregar a inicio.
              </Step>
            </ol>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button onClick={openInSafari} className="gap-2">
                <CompassIcon className="size-4" />
                Abrir en Safari
              </Button>
              <Button variant="outline" onClick={copyAppUrl} className="gap-2">
                <CopyIcon className="size-4" />
                Copiar el link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Si el botón no hace nada, copiá el link y pegalo en Safari a
              mano — iOS no le da a los navegadores una forma oficial de
              abrirse entre sí.
            </p>
          </>
        )}

        {state === "manual" && (
          <>
            <DialogHeader>
              <DialogTitle>Instalar desde el menú del navegador</DialogTitle>
              <DialogDescription>
                Tu navegador no nos dio el diálogo de instalación. Suele pasar
                si ya la tenés instalada, o si cerraste el cartel de instalar
                alguna vez — Chrome deja de ofrecerlo por un tiempo.
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm">
              <Step n={1}>
                Abrí el menú <MoreVerticalIcon className="size-4 shrink-0" /> del
                navegador.
              </Step>
              <Step n={2}>
                <span>Elegí "Instalar aplicación" o "Agregar a pantalla principal".</span>
              </Step>
              <Step n={3}>
                <span>
                  Si no aparece, fijate en tu pantalla de inicio: puede que ya
                  esté instalada.
                </span>
              </Step>
            </ol>
          </>
        )}
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
      <InstallInstructions
        state={state}
        open={showIosHelp}
        onOpenChange={setShowIosHelp}
      />
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

  // "manual" usually means already-installed; nagging there would be noise.
  // The user-menu entry still covers it.
  const actionable = state === "prompt" || state === "ios" || state === "ios-other"
  if (dismissed || !actionable) return null

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
      <InstallInstructions
        state={state}
        open={showIosHelp}
        onOpenChange={setShowIosHelp}
      />
    </>
  )
}
