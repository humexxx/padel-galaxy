import { cn } from "@/lib/utils"

type Props = {
  className?: string
  showWordmark?: boolean
}

export function BrandLogo({ className, showWordmark = true }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-9 shrink-0" />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-heading text-base font-bold tracking-tight">
            Padel Galaxy
          </span>
          <span className="mt-0.5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Pozos
          </span>
        </div>
      )}
    </div>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt="Padel Galaxy"
      width={64}
      height={64}
      className={cn("rounded-full select-none", className)}
    />
  )
}
