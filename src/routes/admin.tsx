import * as React from "react"
import { Loader2Icon, ShieldCheckIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/auth-context"
import { useAppSettings } from "@/hooks/use-settings"
import { saveAppSettings } from "@/lib/settings"

export function AdminPage() {
  const { user } = useAuth()
  const { settings, hydrated } = useAppSettings()
  const [saving, setSaving] = React.useState(false)

  async function toggleSignups(next: boolean) {
    setSaving(true)
    try {
      await saveAppSettings({ signupsEnabled: next })
      toast.success(next ? "Registro habilitado" : "Registro deshabilitado")
    } catch (err) {
      console.error(err)
      toast.error("No se pudo guardar el cambio")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <ShieldCheckIcon className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Ingresaste como {user?.email}.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlusIcon className="size-4" />
            Registro de cuentas
          </CardTitle>
          <CardDescription>
            Cuando está apagado, nadie puede crear cuentas nuevas (email o Google). Los usuarios
            existentes siguen pudiendo entrar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="signups" className="text-sm font-medium">
                Permitir creación de cuentas
              </Label>
              <p className="text-xs text-muted-foreground">
                {hydrated
                  ? settings.signupsEnabled
                    ? "Actualmente cualquiera puede registrarse."
                    : "Actualmente el registro está deshabilitado."
                  : "Cargando…"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(saving || !hydrated) && (
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="signups"
                checked={settings.signupsEnabled}
                onCheckedChange={toggleSignups}
                disabled={saving || !hydrated}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximamente</CardTitle>
          <CardDescription>Más herramientas de administración a definir.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>Listado y gestión de todos los pozos (no solo los propios)</li>
            <li>Gestión de usuarios y roles</li>
            <li>Métricas de uso</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
