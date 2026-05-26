import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"

type Point = Record<string, number | string | null>

type Series = {
  /** Key on each datum that holds the Y value. */
  key: string
  /** CSS color for the line. Defaults to `var(--color-primary)`. */
  color?: string
  /** If true, the axis grows downward (1 at top) — for rankings. */
  invertY?: boolean
  /** Tick formatter for this axis. */
  formatY?: (value: number) => string
  /** Human-readable name (for the tooltip / a11y label). */
  label?: string
}

type Props<T extends Point> = {
  data: T[]
  /** Key on each datum that holds the X value (a millis date or a string label). */
  xKey: keyof T & string
  /** Primary series on the LEFT Y axis. */
  primary: Series
  /**
   * Optional secondary series rendered on the RIGHT Y axis with its own
   * scale + invert. Used for "always show ranking next to the picked
   * metric" dashboards.
   */
  secondary?: Series
  /** Used to format X axis ticks. Defaults to `String(value)`. */
  formatX?: (value: T[keyof T]) => string
  /** Custom tooltip body (full control). */
  tooltipLabel?: (point: T) => React.ReactNode
  className?: string
  height?: number
}

export function LineChart<T extends Point>({
  data,
  xKey,
  primary,
  secondary,
  formatX = (v) => String(v),
  tooltipLabel,
  className,
  height = 240,
}: Props<T>) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Sin datos para mostrar.
      </div>
    )
  }

  const primaryColor = primary.color ?? "var(--color-primary)"
  const secondaryColor = secondary?.color ?? "var(--color-chart-2)"

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={{
            top: 12,
            right: secondary ? 8 : 12,
            bottom: 0,
            left: -8,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey={xKey as string}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tickFormatter={(v) => formatX(v as T[keyof T])}
            minTickGap={20}
          />
          {/* Primary axis (left) */}
          <YAxis
            yAxisId="primary"
            orientation="left"
            tick={{ fontSize: 11, fill: primaryColor }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tickFormatter={primary.formatY ?? ((v) => String(v))}
            reversed={primary.invertY}
            allowDecimals={false}
            width={40}
          />
          {/* Secondary axis (right) — only when a second series is provided */}
          {secondary && (
            <YAxis
              yAxisId="secondary"
              orientation="right"
              tick={{ fontSize: 11, fill: secondaryColor }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              tickFormatter={secondary.formatY ?? ((v) => String(v))}
              reversed={secondary.invertY}
              allowDecimals={false}
              width={36}
            />
          )}
          <Tooltip
            cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
            content={
              tooltipLabel
                ? ({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const datum = payload[0].payload as T
                    return (
                      <div
                        style={{
                          background: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 12,
                          color: "var(--color-popover-foreground)",
                        }}
                      >
                        {tooltipLabel(datum)}
                      </div>
                    )
                  }
                : undefined
            }
          />
          <Line
            yAxisId="primary"
            type="monotone"
            dataKey={primary.key}
            name={primary.label ?? primary.key}
            stroke={primaryColor}
            strokeWidth={2}
            dot={{ r: 3, fill: primaryColor, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive
            animationDuration={500}
          />
          {secondary && (
            <Line
              yAxisId="secondary"
              type="monotone"
              dataKey={secondary.key}
              name={secondary.label ?? secondary.key}
              stroke={secondaryColor}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, fill: secondaryColor, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive
              animationDuration={500}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
