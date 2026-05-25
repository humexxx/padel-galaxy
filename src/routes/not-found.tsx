import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-7xl font-bold text-muted-foreground">404</p>
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">
        Esta URL no existe o ya no está disponible.
      </p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
