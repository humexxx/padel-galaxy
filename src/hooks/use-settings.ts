import * as React from "react"

import { DEFAULT_SETTINGS, subscribeAppSettings, type AppSettings } from "@/lib/settings"

export function useAppSettings() {
  const [settings, setSettings] = React.useState<AppSettings>(DEFAULT_SETTINGS)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    const unsub = subscribeAppSettings((s) => {
      setSettings(s)
      setHydrated(true)
    })
    return unsub
  }, [])

  return { settings, hydrated }
}
