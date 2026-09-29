import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster } from "@/components/ui/sonner"
import { initPwa } from "@/lib/pwa"
import { reloadOnceForStaleChunk } from "@/lib/reload-once"
import { exposeBuildStamp } from "@/lib/version"
import { router } from "@/router"

import "./index.css"

// Before render: Chrome fires `beforeinstallprompt` once, and early.
initPwa()
exposeBuildStamp()

// A chunk preload that 404s after a deploy: fetch the new build instead of
// surfacing an error. The route error screen covers the non-preload path.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForStaleChunk()) event.preventDefault()
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
