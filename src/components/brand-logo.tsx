import { cn } from "@/lib/utils"

type Props = {
  className?: string
  showWordmark?: boolean
}

export function BrandLogo({ className, showWordmark = true }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-7 shrink-0" />
      {showWordmark && (
        <span className="text-base font-bold tracking-tight">
          Padel Galaxy
        </span>
      )}
    </div>
  )
}

/**
 * The mark: a padel racket, as a filled silhouette — round head with a
 * throat, a 3×3 grid of punched holes, a short handle with a rounded butt.
 * Inline SVG in `currentColor` so it takes the surrounding text color,
 * with no badge and no theme swap. The favicon and the home-screen icons
 * carry the same geometry on a solid badge (see public/favicon.svg).
 *
 * Filled rather than outlined on purpose: an outlined ring with a stick is
 * the magnifying-glass glyph. The holes are subpaths wound the other way
 * so the nonzero fill rule cuts them out, keeping the whole thing a plain
 * `currentColor` shape with no background color baked in. At 24 px the
 * holes merge into a mesh, which still says "padel" rather than "tennis".
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("shrink-0 select-none", className)}
      fill="currentColor"
    >
      <path d="M7.4 12.2a8.6 8.6 0 1 1 17.2 0a8.6 8.6 0 1 1 -17.2 0ZM10.6 8.1a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM14.7 8.1a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM18.8 8.1a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM10.6 12.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM14.7 12.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM18.8 12.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM10.6 16.3a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM14.7 16.3a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM18.8 16.3a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z" />
      <path d="M12.2 18.4L13.4 24.6H18.6L19.8 18.4Z" />
      <rect x="13.4" y="21.6" width="5.2" height="8.2" rx="2.6" />
    </svg>
  )
}
