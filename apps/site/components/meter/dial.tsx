"use client"

import { motion, useReducedMotion, useSpring, useTransform } from "motion/react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"

const W = 400
const H = 236
const PIVOT_X = W / 2
const PIVOT_Y = 292
const R = 228
const SWEEP = 46
const REST = -SWEEP - 3

const angleFor = (share: number) => -SWEEP + share * 2 * SWEEP

const round = (n: number) => Math.round(n * 100) / 100

function polar(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180
  return {
    x: round(PIVOT_X + radius * Math.sin(rad)),
    y: round(PIVOT_Y - radius * Math.cos(rad)),
  }
}

const NEEDLE_BASE = 70
const NEEDLE_TIP = R + 12

function arc(radius: number, from: number, to: number) {
  const a = polar(from, radius)
  const b = polar(to, radius)
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`
}

const TICKS = Array.from({ length: 41 }, (_, i) => i / 40)
const LABELS = [0, 25, 50, 75, 100]

interface DialProps {
  value: number | null
  label: string
  className?: string
  compact?: boolean
}

const CAPTION_H = 44

const END_STOP = {
  fontSize: 24,
  fontWeight: 500,
  fill: "var(--ink)",
  letterSpacing: 0,
  className: "font-mono",
} as const

export function Dial({ value, label, className, compact }: DialProps) {
  const reduceMotion = useReducedMotion()
  const angle = useSpring(REST, { stiffness: 140, damping: 15, mass: 1.1 })
  const baseX = useTransform(angle, (a) => polar(a, NEEDLE_BASE).x)
  const baseY = useTransform(angle, (a) => polar(a, NEEDLE_BASE).y)
  const tipX = useTransform(angle, (a) => polar(a, NEEDLE_TIP).x)
  const tipY = useTransform(angle, (a) => polar(a, NEEDLE_TIP).y)

  useEffect(() => {
    const target = value === null ? REST : angleFor(value)
    if (reduceMotion) angle.jump(target)
    else angle.set(target)
  }, [value, reduceMotion, angle])

  return (
    <svg
      viewBox={`0 0 ${W} ${compact ? H - CAPTION_H : H}`}
      role="img"
      aria-label={label}
      className={className}
    >
      <defs>
        <clipPath id={compact ? "dial-window-compact" : "dial-window"}>
          <rect
            x="0"
            y="0"
            width={W}
            height={compact ? H - CAPTION_H : H}
            rx="14"
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${compact ? "dial-window-compact" : "dial-window"})`}>
        <rect width={W} height={H} fill="var(--face)" />

        <path
          d={arc(R - 22, -SWEEP, SWEEP)}
          stroke="var(--etch)"
          strokeOpacity="0.45"
          strokeWidth="5"
          fill="none"
        />

        <path
          d={arc(R, -SWEEP, SWEEP)}
          stroke="var(--ink)"
          strokeWidth="1.25"
          fill="none"
        />
        <path
          d={arc(R, -SWEEP, -SWEEP + 12)}
          stroke="var(--human)"
          strokeWidth="3"
          fill="none"
        />
        <path
          d={arc(R, SWEEP - 12, SWEEP)}
          stroke="var(--machine)"
          strokeWidth="3"
          fill="none"
        />

        {TICKS.map((t) => {
          const major = Math.round(t * 100) % 25 === 0
          const mid = !major && Math.round(t * 100) % 5 === 0
          const length = major ? 14 : mid ? 9 : 5
          const a = polar(angleFor(t), R)
          const b = polar(angleFor(t), R + length)
          return (
            <line
              key={t}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--ink)"
              strokeWidth={major ? 1.5 : 1}
              strokeLinecap="round"
            />
          )
        })}

        <g {...(compact ? { "data-fade-in": "" } : { "data-fade": "" })}>
          {LABELS.filter((n) => !compact || (n > 0 && n < 100)).map((n) => {
            const p = polar(angleFor(n / 100), R + (compact ? 34 : 28))
            return (
              <text
                key={n}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={compact ? 24 : 12}
                fontWeight={compact ? 500 : undefined}
                fill="var(--ink)"
                className="font-mono"
              >
                {n}
              </text>
            )
          })}

          <text
            x={compact ? 18 : 36}
            y={compact ? 176 : 168}
            fontSize={compact ? 19 : 10}
            fill="var(--human)"
            className={cn(
              "legend font-sans",
              compact ? "font-bold" : "font-semibold"
            )}
          >
            {compact && <tspan {...END_STOP}>0</tspan>}
            <tspan dx={compact ? 10 : 0}>Human</tspan>
          </text>
          <text
            x={W - (compact ? 18 : 36)}
            y={compact ? 176 : 168}
            textAnchor="end"
            fontSize={compact ? 19 : 10}
            fill="var(--machine)"
            className={cn(
              "legend font-sans",
              compact ? "font-bold" : "font-semibold"
            )}
          >
            Machine
            {compact && (
              <tspan dx={10} {...END_STOP}>
                100
              </tspan>
            )}
          </text>
        </g>

        <motion.line
          x1={baseX}
          y1={baseY}
          x2={tipX}
          y2={tipY}
          stroke="var(--ink)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />

        {!compact && (
          <g data-fade>
            <rect x="0" y={H - 44} width={W} height="44" fill="var(--sheet)" />
            <line
              x1="0"
              x2={W}
              y1={H - 44}
              y2={H - 44}
              stroke="var(--hairline)"
            />
            <text
              x={W / 2}
              y={H - 19}
              textAnchor="middle"
              fontSize="10"
              fill="var(--graphite)"
              className="legend font-sans font-medium"
            >
              % machine-shaped
            </text>
          </g>
        )}
      </g>
      <rect
        x="0.5"
        y="0.5"
        width={W - 1}
        height={(compact ? H - CAPTION_H : H) - 1}
        rx="14"
        fill="none"
        stroke="var(--hairline)"
      />
    </svg>
  )
}
