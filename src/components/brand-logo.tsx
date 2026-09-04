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
 * The mark: a ball with a single orbit. Inline SVG in `currentColor` so it
 * takes the surrounding text color — dark on the light landing, light in
 * the dark shell — with no badge and no theme swap. The favicon and the
 * home-screen icons carry the same geometry on a solid badge, where the
 * background can't be trusted (see public/favicon.svg).
 *
 * The orbit passes behind the ball on top (faint) and in front below
 * (full); that one depth cue is what keeps it from reading as a flat glyph
 * at 24 px.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("shrink-0 select-none", className)}
    >
      <g
        transform="translate(16 16) rotate(-24)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M-13 0A13 4.6 0 0 1 13 0" opacity="0.4" />
        <circle r="6.6" fill="currentColor" stroke="none" />
        <path d="M-13 0A13 4.6 0 0 0 13 0" />
      </g>
    </svg>
  )
}
