import * as React from "react"
import { MailCheckIcon } from "lucide-react"
import { sendEmailVerification } from "firebase/auth"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { auth } from "@/lib/firebase"

/**
 * Nudges email/password accounts to verify their address. Until they do,
 * an organizer's invite can't link to them (the rules only trust verified
 * emails), so their history stays empty. Google accounts arrive verified
 * and never see this.
 */
export function VerifyEmailBanner() {
  const { user } = useAuth()
  const [verified, setVerified] = React.useState(false)
  const [busy, setBusy] = React.useState<"resend" | "check" | null>(null)

  const needsVerification =
    user !== null &&
    !user.emailVerified &&
    user.providerData.some((p) => p.providerId === "password")
  if (!needsVerification || verified) return null

  async function resend() {
    const current = auth.currentUser
    if (!current) return
    setBusy("resend")
    try {
      await sendEmailVerification(current, { url: `${window.location.origin}/pozos` })
      toast.success(`Te mandamos el link a ${current.email}.`)
    } catch (err) {
      const code = (err as { code?: string }).code
      toast.error(
        code === "auth/too-many-requests"
          ? "Ya te mandamos varios. Esperá unos minutos y revisá spam."
          : "No se pudo enviar el email.",
      )
    } finally {
      setBusy(null)
    }
  }

  async function check() {
    const current = auth.currentUser
    if (!current) return
    setBusy("check")
    try {
      await current.reload()
      if (!current.emailVerified) {
        toast.info("Todavía no figura verificado. Abrí el link del email y volvé a intentar.")
        return
      }
      // A fresh token carries email_verified, which re-runs the profile
      // sync in the auth context and links any pending invite.
      await current.getIdToken(true)
      setVerified(true)
      toast.success("Email verificado.")
    } catch {
      toast.error("No se pudo comprobar. Probá de nuevo.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="border-b bg-primary/5">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <MailCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-sm">
            <span className="font-medium">Verificá tu email</span>{" "}
            <span className="text-muted-foreground">
              para que tus invitaciones y tu historial se vinculen a tu cuenta.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={resend}
            disabled={busy !== null}
          >
            {busy === "resend" ? "Enviando…" : "Reenviar email"}
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={check}
            disabled={busy !== null}
          >
            {busy === "check" ? "Comprobando…" : "Ya lo verifiqué"}
          </Button>
        </div>
      </div>
    </div>
  )
}
