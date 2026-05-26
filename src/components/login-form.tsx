import * as React from "react"
import { useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import { FirebaseError } from "firebase/app"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Heading, Text } from "@/components/ui/typography"
import { SignupsDisabledError, useAuth } from "@/contexts/auth-context"
import { useAppSettings } from "@/hooks/use-settings"

type Mode = "signin" | "signup"

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/invalid-email": "El email no es válido.",
  "auth/user-not-found": "No existe una cuenta con ese email.",
  "auth/wrong-password": "Contraseña incorrecta.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese email.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/popup-closed-by-user": "Cancelaste el login con Google.",
  "auth/network-request-failed": "Sin conexión. Intentá de nuevo.",
}

function describeAuthError(err: unknown): string {
  if (err instanceof SignupsDisabledError) return err.message
  if (err instanceof FirebaseError) return AUTH_ERROR_MESSAGES[err.code] ?? err.message
  if (err instanceof Error) return err.message
  return "No se pudo iniciar sesión"
}

export function LoginForm({ className, ...props }: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const { settings } = useAppSettings()
  const signupsEnabled = settings.signupsEnabled

  const [mode, setMode] = React.useState<Mode>("signin")

  React.useEffect(() => {
    if (!signupsEnabled && mode === "signup") setMode("signin")
  }, [signupsEnabled, mode])
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)

  function goNext() {
    const next = searchParams.get("next")
    navigate(next && next.startsWith("/") ? next : "/pozos", { replace: true })
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
        toast.success("Cuenta creada")
      }
      goNext()
    } catch (err) {
      toast.error(describeAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle() {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      goNext()
    } catch (err) {
      toast.error(describeAuthError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = loading || googleLoading
  const submitLabel = mode === "signin" ? "Ingresar" : "Crear cuenta"

  return (
    <form
      onSubmit={onSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Heading level="h3" as="h1">
            {mode === "signin" ? "Bienvenido de nuevo" : "Crear cuenta"}
          </Heading>
          <Text variant="muted" className="text-balance">
            Ingresá para crear y gestionar tus pozos de pádel.
          </Text>
        </div>

        <Field>
          <Button
            type="button"
            variant="outline"
            onClick={onGoogle}
            disabled={busy}
          >
            {googleLoading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <GoogleIcon className="size-4" />
            )}
            Continuar con Google
          </Button>
        </Field>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>o con email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={busy}
          />
        </Field>
        <Field>
          <Button type="submit" disabled={busy}>
            {loading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                {mode === "signin" ? "Ingresando…" : "Creando…"}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </Field>

        {signupsEnabled ? (
          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              disabled={busy}
            >
              {mode === "signin" ? "Crear una" : "Ingresar"}
            </button>
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            El registro de cuentas está deshabilitado.
          </p>
        )}
      </FieldGroup>
    </form>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.47 12c0-.73.13-1.44.37-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}
