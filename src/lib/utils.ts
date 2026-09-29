import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** A same-app path from `?next=`, or null. `//host` would leave the app. */
export function safeNextPath(raw: string | null): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null
}
