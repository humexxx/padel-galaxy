import * as React from "react"
import { isRouteErrorResponse, Link, useRouteError } from "react-router"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Heading, Text } from "@/components/ui/typography"
import { isStaleChunkError, reloadOnceForStaleChunk } from "@/lib/reload-once"

/**
 * What the user sees instead of React Router's default (English, stack
 * trace) error page. A missing chunk from a previous deploy reloads once
 * on its own; anything else offers a reload and a way home.
 */
export function RouteError() {
  const error = useRouteError()
  const stale = isStaleChunkError(error)

  React.useEffect(() => {
    if (stale && reloadOnceForStaleChunk()) return
    console.error("Route error:", error)
  }, [error, stale])

  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlertIcon className="size-10 text-destructive" />
      <div className="space-y-1">
        <Heading level="h3" as="h1">
          {notFound ? "No encontramos esta página" : "Algo salió mal"}
        </Heading>
        <Text variant="muted">
          {stale
            ? "Hay una versión nueva de la app. Recargá para usarla."
            : "Probá recargar. Si sigue pasando, volvé al inicio."}
        </Text>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link to="/pozos">Ir a Pozos</Link>
        </Button>
        <Button onClick={() => window.location.reload()}>
          <RefreshCwIcon className="size-4" />
          Recargar
        </Button>
      </div>
    </div>
  )
}
