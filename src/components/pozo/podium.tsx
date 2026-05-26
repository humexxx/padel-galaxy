import { CrownIcon, MedalIcon, TrophyIcon } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import type { PlayerStanding } from "@/lib/pozo/types"

type Props = {
  standings: PlayerStanding[]
}

type Position = {
  index: number
  order: number
  label: string
  size: string
  bg: string
  icon: typeof CrownIcon
  /** Stagger: 1st rises last for dramatic effect. */
  delay: number
}

const POSITIONS: Position[] = [
  {
    index: 1,
    order: 0,
    label: "2°",
    size: "h-36 sm:h-44",
    bg: "from-slate-400/40 to-slate-300/10 border-slate-300/40",
    icon: MedalIcon,
    delay: 0.15,
  },
  {
    index: 0,
    order: 1,
    label: "1°",
    size: "h-44 sm:h-56",
    bg: "from-amber-400/50 to-amber-300/10 border-amber-400/50",
    icon: CrownIcon,
    delay: 0.45,
  },
  {
    index: 2,
    order: 2,
    label: "3°",
    size: "h-28 sm:h-36",
    bg: "from-orange-400/40 to-orange-300/10 border-orange-400/40",
    icon: TrophyIcon,
    delay: 0,
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
        .map(({ index, label, size, bg, player, icon: Icon, delay }) => (
          <motion.div
            key={index}
            initial={{ y: 60, opacity: 0, scaleY: 0.6 }}
            animate={{ y: 0, opacity: 1, scaleY: 1 }}
            transition={{
              delay,
              type: "spring",
              stiffness: 110,
              damping: 14,
              mass: 0.8,
            }}
            style={{ transformOrigin: "bottom" }}
            className={cn(
              "flex flex-1 max-w-[180px] flex-col items-center justify-end overflow-hidden rounded-t-xl border bg-gradient-to-b p-3 text-center",
              bg,
              size,
            )}
          >
            <motion.div
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{
                delay: delay + 0.25,
                type: "spring",
                stiffness: 200,
                damping: 12,
              }}
              className="mb-1"
            >
              <Icon
                className={cn(
                  "size-7 sm:size-9",
                  index === 0 && "text-amber-500",
                  index === 1 && "text-slate-400",
                  index === 2 && "text-orange-500",
                )}
              />
            </motion.div>
            <p className="line-clamp-2 text-sm font-semibold leading-tight sm:text-base">
              {player.player.name}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {player.gamesWon} games ·{" "}
              <span
                className={cn(
                  player.gamesDiff > 0 && "text-emerald-600 dark:text-emerald-400",
                  player.gamesDiff < 0 && "text-destructive",
                )}
              >
                {player.gamesDiff > 0 ? `+${player.gamesDiff}` : player.gamesDiff}
              </span>
            </p>
          </motion.div>
        ))}
    </div>
  )
}
