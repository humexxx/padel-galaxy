import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { Heading, Mono, Text } from "@/components/ui/typography"

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Mono className="text-7xl font-bold text-muted-foreground">404</Mono>
      <Heading level="h2">Página no encontrada</Heading>
      <Text variant="muted">Esta URL no existe o ya no está disponible.</Text>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
