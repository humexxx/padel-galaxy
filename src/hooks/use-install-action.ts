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
    // Only "prompt" has a real native dialog to fire; everything else needs
    // the instructions panel.
    if (state === "prompt") void promptInstall()
    else setShowIosHelp(true)
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
  // Anything short of "already installed" gets an entry. A menu with no
  // install option and no explanation is the failure mode this exists to
  // prevent.
  return { ...action, state, available: state !== "installed" && state !== "hidden" }
}
