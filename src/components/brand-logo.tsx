import { cn } from "@/lib/utils"

type Props = {
  className?: string
  showWordmark?: boolean
}

export function BrandLogo({ className, showWordmark = true }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-8 shrink-0" />
      {showWordmark && (
        <span className="text-base font-bold tracking-tight">
          Padel Galaxy
        </span>
      )}
    </div>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/favicon.svg"
      alt="Padel Galaxy"
      className={cn("select-none", className)}
    />
  )
}
