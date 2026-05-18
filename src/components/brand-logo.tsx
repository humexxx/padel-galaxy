import { cn } from "@/lib/utils"

type Props = {
  className?: string
  showWordmark?: boolean
}

export function BrandLogo({ className, showWordmark = true }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-8 shrink-0" />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-heading text-base font-bold tracking-tight">Padel Galaxy</span>
          <span className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Pozos
          </span>
        </div>
      )}
    </div>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={cn("text-primary", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pg-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <path
        d="M32 8c11.046 0 20 8.954 20 20 0 7.732-4.388 14.439-10.81 17.78L40 56h-6l-1.19-10.22C26.388 42.439 22 35.732 22 28 22 16.954 24 8 32 8z"
        fill="url(#pg-grad)"
      />
      <g stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" fill="none">
        <path d="M32 12 L46 26 L40 40 L24 38 L20 22 Z" />
        <path d="M32 12 L40 40" />
        <path d="M20 22 L40 40" />
        <path d="M46 26 L24 38" />
      </g>
      <circle cx="32" cy="12" r="3.4" fill="currentColor" />
      <circle cx="32" cy="12" r="3.4" fill="white" fillOpacity="0.15" />
      <path d="M30.4 10.6 Q32 13 33.6 13.4" stroke="white" strokeOpacity="0.55" strokeWidth="0.7" fill="none" />
    </svg>
  )
}
