import { CrownIcon, MedalIcon, TrophyIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PlayerStanding } from "@/lib/pozo/types"

type Props = {
  standings: PlayerStanding[]
}

const POSITIONS: {
  index: number
  order: number
  label: string
  size: string
  bg: string
  icon: typeof CrownIcon
}[] = [
  {
    index: 1,
    order: 0,
    label: "2°",
    size: "h-36 sm:h-44",
    bg: "from-slate-400/40 to-slate-300/10 border-slate-300/40",
    icon: MedalIcon,
  },
  {
    index: 0,
    order: 1,
    label: "1°",
    size: "h-44 sm:h-56",
    bg: "from-amber-400/50 to-amber-300/10 border-amber-400/50",
    icon: CrownIcon,
  },
  {
    index: 2,
    order: 2,
    label: "3°",
    size: "h-28 sm:h-36",
    bg: "from-orange-400/40 to-orange-300/10 border-orange-400/40",
    icon: TrophyIcon,
  },
]

export function Podium({ standings }: Props) {
  const top3 = POSITIONS.map((p) => ({ ...p, player: standings[p.index] })).filter(
    (p) => p.player !== undefined,
  )

  return (
    <div className="flex w-full items-end justify-center gap-2 sm:gap-4">
      {top3
        .sort((a, b) => a.order - b.order)
        .map(({ index, label, size, bg, player, icon: Icon }) => (
          <div
            key={index}
            className={cn(
              "flex flex-1 max-w-[180px] flex-col items-center justify-end overflow-hidden rounded-t-xl border bg-gradient-to-b p-3 text-center",
              bg,
              size,
            )}
          >
            <Icon
              className={cn(
                "mb-1 size-7 sm:size-9",
                index === 0 && "text-amber-500",
                index === 1 && "text-slate-400",
                index === 2 && "text-orange-500",
              )}
            />
            <p className="line-clamp-2 text-sm font-semibold leading-tight sm:text-base">
              {player.player.name}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {player.points} pts ·{" "}
              <span className={cn(player.gamesDiff > 0 && "text-emerald-600 dark:text-emerald-400", player.gamesDiff < 0 && "text-destructive")}>
                {player.gamesDiff > 0 ? `+${player.gamesDiff}` : player.gamesDiff}
              </span>
            </p>
          </div>
        ))}
    </div>
  )
}
