import * as React from "react"
import { useNavigate } from "react-router"
import { FirebaseError } from "firebase/app"
import { deleteUser, updateProfile } from "firebase/auth"
import {
  AlertTriangleIcon,
  CheckIcon,
  Loader2Icon,
  SaveIcon,
  ShieldIcon,
  SlidersIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Heading, Text } from "@/components/ui/typography"
import { PageContainer } from "@/components/page-container"
import { useAuth } from "@/contexts/auth-context"
import { useUserProfile } from "@/hooks/use-user-profile"
import { cn } from "@/lib/utils"
import {
  setShootingStarsEnabled,
  useShootingStarsEnabled,
} from "@/lib/preferences"
import {
  deleteUserProfile,
  PREFERRED_SIDE_LABELS,
  saveUserProfile,
  type PreferredSide,
} from "@/lib/user-profile"

const PREFERRED_SIDE_DESCRIPTIONS: Record<PreferredSide, string> = {
  drive: "Te ponés en la mitad derecha — forehand al medio.",
  reves: "Te ponés en la mitad izquierda — backhand al medio.",
  any: "Te acomodás donde necesite el equipo.",
}

const SIDE_ORDER: PreferredSide[] = ["any", "reves", "drive"]

type Section = "profile" | "preferences" | "appearance" | "privacy"

const SECTION_ITEMS: { id: Section; label: string; icon: typeof UserIcon }[] = [
  { id: "profile", label: "Perfil", icon: UserIcon },
  { id: "preferences", label: "Preferencias", icon: SlidersIcon },
  { id: "appearance", label: "Apariencia", icon: SparklesIcon },
  { id: "privacy", label: "Privacidad", icon: ShieldIcon },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { profile, hydrated } = useUserProfile()
  const [section, setSection] = React.useState<Section>("profile")
  const [displayName, setDisplayName] = React.useState("")
  const [preferredSide, setPreferredSide] = React.useState<PreferredSide>("any")
  const [saving, setSaving] = React.useState(false)

  // Sync local form state from the streamed profile. Re-runs if the doc
  // updates from another tab/device, so the form always shows the latest.
  React.useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName)
    setPreferredSide(profile.preferredSide)
  }, [profile])

  const cleanName = displayName.trim()
  const authName = user?.displayName ?? ""
  const dirty =
    cleanName !== (profile?.displayName ?? authName) ||
    preferredSide !== (profile?.preferredSide ?? "any")

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !dirty || saving) return
    if (!cleanName) {
      toast.error("El nombre no puede estar vacío.")
      return
    }
    setSaving(true)
    try {
      if (cleanName !== authName) {
        await updateProfile(user, { displayName: cleanName })
      }
      await saveUserProfile({
        uid: user.uid,
        displayName: cleanName,
        preferredSide,
      })
      await user.reload()
      toast.success("Cambios guardados")
    } catch (err) {
      console.error(err)
      toast.error("No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Heading level="h1">Configuración</Heading>
        <Text variant="muted">
          Tu perfil y preferencias de juego. Solo vos las podés ver y editar.
        </Text>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <SettingsNav section={section} onChange={setSection} />

        <div className="min-w-0">
          {section === "privacy" ? (
            <PrivacySection
              email={user.email ?? ""}
              onAfterDelete={async () => {
                await signOut().catch(() => undefined)
                navigate("/login", { replace: true })
              }}
              onRequiresRecentLogin={async () => {
                await signOut().catch(() => undefined)
                navigate("/login", { replace: true })
                toast.info(
                  "Por seguridad, iniciá sesión de nuevo y volvé a intentar borrar la cuenta.",
                )
              }}
            />
          ) : section === "appearance" ? (
            <AppearanceSection />
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {section === "profile" && (
                <ProfileSection
                  displayName={displayName}
                  onDisplayNameChange={setDisplayName}
                  email={user.email ?? ""}
                  disabled={!hydrated || saving}
                />
              )}
              {section === "preferences" && (
                <PreferencesSection
                  value={preferredSide}
                  onChange={setPreferredSide}
                  disabled={!hydrated || saving}
                />
              )}

              {dirty && (
                <div className="sticky bottom-4 z-10 flex justify-end">
                  <Button
                    type="submit"
                    disabled={!dirty || saving || !hydrated}
                    size="lg"
                    className="shadow-md"
                  >
                    {saving ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin" />
                        Guardando…
                      </>
                    ) : (
                      <>
                        <SaveIcon className="size-4" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

/**
 * Vertical nav on md+, horizontal pill list on mobile. Each item is a
 * plain button driving local state — no URL routing because settings is a
 * single-page experience and the section choice doesn't need to be
 * shareable.
 */
function SettingsNav({
  section,
  onChange,
}: {
  section: Section
  onChange: (next: Section) => void
}) {
  return (
    <nav
      aria-label="Secciones de configuración"
      className="flex shrink-0 overflow-x-auto md:flex-col"
    >
      <ul className="flex gap-1 md:flex-col">
        {SECTION_ITEMS.map((item) => {
          const Icon = item.icon
          const active = section === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  "md:w-full md:justify-start",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function ProfileSection({
  displayName,
  onDisplayNameChange,
  email,
  disabled,
}: {
  displayName: string
  onDisplayNameChange: (next: string) => void
  email: string
  disabled: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Cómo te van a ver el resto de los jugadores.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="displayName">Nombre</FieldLabel>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Tu nombre"
              disabled={disabled}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" value={email} disabled readOnly />
            <Text variant="muted" className="text-xs">
              El email se gestiona desde tu cuenta de Google / proveedor de
              login. No se puede cambiar acá.
            </Text>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function PreferencesSection({
  value,
  onChange,
  disabled,
}: {
  value: PreferredSide
  onChange: (next: PreferredSide) => void
  disabled: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lado preferido</CardTitle>
        <CardDescription>
          El algoritmo de emparejamiento la va a usar para armar parejas más
          equilibradas — drive + revés en cada equipo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => v && onChange(v as PreferredSide)}
          className="grid gap-3 sm:grid-cols-3"
          disabled={disabled}
        >
          {SIDE_ORDER.map((side) => (
            <SidePreferenceCard
              key={side}
              side={side}
              selected={value === side}
            />
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

/**
 * Card that visualizes a half-court split into drive (right) and revés
 * (left), with the picked side highlighted. The native radio is rendered
 * sr-only — the card itself is the clickable target (via the wrapping
 * Label + htmlFor), keeping it keyboard-accessible while letting us style
 * the whole card as the visual control.
 */
function SidePreferenceCard({
  side,
  selected,
}: {
  side: PreferredSide
  selected: boolean
}) {
  return (
    <Label
      htmlFor={`side-${side}`}
      className={cn(
        "group/side relative flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-4 transition-all",
        "hover:border-primary/40",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card",
      )}
    >
      <RadioGroupItem
        id={`side-${side}`}
        value={side}
        className="sr-only"
      />

      {/* Selected checkmark badge */}
      {selected && (
        <span
          aria-hidden
          className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      )}

      <CourtSideVisual
        side={side}
        className={cn(
          "h-20 w-full transition-colors",
          selected ? "text-primary" : "text-muted-foreground",
        )}
      />

      <div className="space-y-0.5">
        <p
          className={cn(
            "text-sm font-semibold",
            selected ? "text-foreground" : "text-foreground",
          )}
        >
          {PREFERRED_SIDE_LABELS[side]}
        </p>
        <p className="text-xs text-muted-foreground">
          {PREFERRED_SIDE_DESCRIPTIONS[side]}
        </p>
      </div>
    </Label>
  )
}

/**
 * Top-down half-court visualization. The viewer is standing at the bottom
 * (where the net would be), looking up. Left half = revés (backhand for
 * right-handed players), right half = drive (forehand). The selected half
 * is filled at full opacity; "any" fills both at reduced opacity to convey
 * "either is fine".
 */
function CourtSideVisual({
  side,
  className,
}: {
  side: PreferredSide
  className?: string
}) {
  const showLeft = side === "reves" || side === "any"
  const showRight = side === "drive" || side === "any"
  const fillOpacity = side === "any" ? 0.18 : 0.35
  return (
    <svg
      viewBox="0 0 80 50"
      className={className}
      role="img"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Outer court boundary */}
      <rect
        x="2"
        y="2"
        width="76"
        height="46"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Center line splitting drive / revés */}
      <line
        x1="40"
        y1="2"
        x2="40"
        y2="48"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.45"
        strokeDasharray="2 2"
      />
      {/* Service line midway down — a small detail that makes it read as
          a real padel court (this is the line between the back area and
          the service boxes). */}
      <line
        x1="2"
        y1="25"
        x2="78"
        y2="25"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.3"
      />
      {/* Highlighted halves */}
      {showLeft && (
        <rect
          x="2"
          y="2"
          width="38"
          height="46"
          fill="currentColor"
          fillOpacity={fillOpacity}
        />
      )}
      {showRight && (
        <rect
          x="40"
          y="2"
          width="38"
          height="46"
          fill="currentColor"
          fillOpacity={fillOpacity}
        />
      )}
    </svg>
  )
}

function AppearanceSection() {
  const enabled = useShootingStarsEnabled()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <CardDescription>
          Detalles visuales que solo afectan este dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Label
          htmlFor="shooting-stars"
          className="flex cursor-pointer items-start justify-between gap-4"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Estrellas fugaces</p>
            <p className="text-xs text-muted-foreground">
              Pequeñas estrellas que cruzan el fondo de la pantalla de tanto en
              tanto. Desactivá si te distrae o querés ahorrar batería.
            </p>
          </div>
          <Switch
            id="shooting-stars"
            checked={enabled}
            onCheckedChange={(next) => setShootingStarsEnabled(next)}
          />
        </Label>
      </CardContent>
    </Card>
  )
}

/**
 * Destructive section: account deletion. Two-step flow:
 *   1. Delete the user's profile doc (`/users/{uid}`). MUST happen while
 *      auth user still exists, otherwise `isOwner(uid)` returns false.
 *   2. Call `deleteUser(auth.currentUser)`. On
 *      `auth/requires-recent-login` we punt back to the caller to sign
 *      out + redirect to login for re-auth.
 *
 * Pozos/players/groups owned by this user are NOT cascaded — that needs a
 * Cloud Function (onAuthDelete) for atomicity + admin permissions.
 */
function PrivacySection({
  email,
  onAfterDelete,
  onRequiresRecentLogin,
}: {
  email: string
  onAfterDelete: () => Promise<void>
  onRequiresRecentLogin: () => Promise<void>
}) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [confirmText, setConfirmText] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)

  const canDelete = confirmText.trim().toLowerCase() === email.toLowerCase()

  async function handleDelete() {
    if (!user || !canDelete) return
    setDeleting(true)
    try {
      await deleteUserProfile(user.uid)
      await deleteUser(user)
      toast.success("Cuenta eliminada.")
      setOpen(false)
      await onAfterDelete()
    } catch (err) {
      if (err instanceof FirebaseError && err.code === "auth/requires-recent-login") {
        setOpen(false)
        await onRequiresRecentLogin()
        return
      }
      console.error(err)
      toast.error(
        err instanceof Error
          ? `No se pudo borrar la cuenta: ${err.message}`
          : "No se pudo borrar la cuenta",
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangleIcon className="size-5" />
          Zona de peligro
        </CardTitle>
        <CardDescription>
          Acciones permanentes. No hay manera de deshacerlas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Eliminar cuenta</p>
            <p className="text-xs text-muted-foreground">
              Borra tu perfil y desactiva tu acceso. Los pozos y jugadores que
              creaste quedan archivados sin owner — un admin puede limpiarlos.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next)
              if (!next) setConfirmText("")
            }}
          >
            <DialogTrigger
              render={
                <Button variant="destructive" size="sm" className="shrink-0">
                  <Trash2Icon className="size-4" />
                  Eliminar cuenta
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
                <DialogDescription>
                  Esto borra tu perfil de Padel Galaxy y desactiva tu login.
                  No se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-email">
                  Para confirmar, escribí tu email{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {email}
                  </code>
                </Label>
                <Input
                  id="confirm-email"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={email}
                  autoComplete="off"
                  disabled={deleting}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={!canDelete || deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      Eliminando…
                    </>
                  ) : (
                    <>
                      <Trash2Icon className="size-4" />
                      Eliminar definitivamente
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
