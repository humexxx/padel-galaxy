import * as React from "react"

import { promptInstall, useInstallState, type InstallState } from "@/lib/pwa"

/**
 * Shared trigger logic behind every install affordance. Chrome hands us an
 * event we can fire directly; iOS Safari has no such API, so there the only
 * honest move is to show the user where the Share-sheet item lives.
 */
export function useInstallAction(state: InstallState) {
  const [showIosHelp, setShowIosHelp] = React.useState(false)
  const trigger = React.useCallback(() => {
    if (state === "ios") setShowIosHelp(true)
    else void promptInstall()
  }, [state])
  return { trigger, showIosHelp, setShowIosHelp }
}

/**
 * Always-available fallback for the user menu, so dismissing the banner isn't
 * a one-way door. Returns props rather than a menu item, because
 * DropdownMenuItem has to be rendered inside its own menu tree.
 */
export function useInstallMenuEntry() {
  const state = useInstallState()
  const action = useInstallAction(state)
  return { ...action, available: state === "prompt" || state === "ios" }
}
