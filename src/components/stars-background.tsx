import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"
import { useShootingStarsEnabled } from "@/lib/preferences"

type ShootingStar = {
  x: number
  y: number
  angle: number
  distance: number
  length: number
  duration: number
  delay: number
  peak: number
  star: number
}

// Seeded PRNG so the streak choreography is stable across renders/routes.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Stratified sampling: divide the viewport into a 3×2 grid (upper half of
// the screen) and place exactly one star per cell with jitter. Avoids the
// clumping that plain uniform random produces with small sample sizes.
const SHOOTS: ShootingStar[] = (() => {
  const rand = mulberry32(13)
  const cols = 3
  const rows = 2
  const stars: ShootingStar[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      stars.push({
        x: ((col + rand()) / cols) * 100,
        y: ((row + rand()) / rows) * 55,
        // All going down-right at similar angles — consistent "meteor shower" feel.
        angle: 22 + rand() * 14,
        distance: 180 + rand() * 160,
        length: 70 + rand() * 50,
        // Long total cycle, short visible streak → sporadic feel.
        duration: 9 + rand() * 11,
        delay: rand() * 14,
        peak: 0.22 + rand() * 0.13,
        star: 7 + rand() * 3.5,
      })
    }
  }
  return stars
})()

// Classic 4-point sparkle: concave sides between four cardinal tips.
const SPARKLE_PATH =
  "M12 2 Q 13 11 22 12 Q 13 13 12 22 Q 11 13 2 12 Q 11 11 12 2 Z"

function ShootingStarsLayer() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {SHOOTS.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180
        const dx = Math.cos(rad) * s.distance
        const dy = Math.sin(rad) * s.distance
        return (
          <div
            key={i}
            data-shooting-star
            className="absolute size-0 text-primary"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              opacity: 0,
              // Hint the compositor to promote each streak to its own GPU
              // layer — transform + opacity animations are then handled off
              // the main thread.
              willChange: "transform, opacity",
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
              ["--peak" as string]: String(s.peak),
              animation: `shooting-star-travel ${s.duration}s ${s.delay}s infinite`,
            } as CSSProperties}
          >
            {/* Rotated streak container: orients the gradient along the
                motion direction. The inner div shrinks horizontally so the
                tail recedes toward the head as the star travels. */}
            <div
              style={{
                position: "absolute",
                right: 0,
                // Center the streak's 1.5px line on the container origin (= star
                // center). Without this offset the line's geometric center sits
                // at y = height/2, making it visually drift below the sparkle.
                top: "-0.75px",
                width: `${s.length}px`,
                height: "1.5px",
                transform: `rotate(${s.angle}deg)`,
                transformOrigin: "100% 50%",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background:
                    "linear-gradient(to right, transparent, currentColor)",
                  transformOrigin: "100% 50%",
                  willChange: "transform",
                  animation: `shooting-star-shrink ${s.duration}s ${s.delay}s infinite`,
                }}
              />
            </div>

            {/* Sparkle head: anchored at the container origin (= head
                position after translate). NOT rotated with the streak —
                stays upright so it reads as a star, not a tilted blob. */}
            <svg
              viewBox="0 0 24 24"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: `${s.star}px`,
                height: `${s.star}px`,
                transform: "translate(50%, -50%)",
                fill: "currentColor",
              }}
            >
              <path d={SPARKLE_PATH} />
            </svg>
          </div>
        )
      })}
    </div>
  )
}

// Isolated subscriber: only this tiny component re-renders when the
// preference changes. Keeps the StarsBackground wrapper (which contains
// `children`) inert to toggle updates — toggling the setting won't trigger
// a re-render of the whole app subtree.
function ShootingStarsGate() {
  const enabled = useShootingStarsEnabled()
  if (!enabled) return null
  return <ShootingStarsLayer />
}

export function StarsBackground({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <ShootingStarsGate />
      {children}
    </div>
  )
}
