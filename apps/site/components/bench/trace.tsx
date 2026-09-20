import type { Decision } from "@slop/model"
import { COLOR } from "@/lib/decisions"

export type TracePoint = {
  index: number
  top: number
  bottom: number
  share: number
  decision: Decision
}

const PAD = 7
const GRID = [0, 0.25, 0.5, 0.75, 1]

interface TraceProps {
  points: TracePoint[]
  width: number
  height: number
  active: number | undefined
}

export function Trace({ points, width, height, active }: TraceProps) {
  if (!width || !height) return null
  const x = (share: number) => PAD + share * (width - PAD * 2)
  const middle = (p: TracePoint) => (p.top + p.bottom) / 2

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="overflow-visible"
    >
      {points.map((p) => (
        <rect
          key={p.index}
          x="0"
          y={p.top + 3}
          width={width}
          height={Math.max(0, p.bottom - p.top - 6)}
          rx="2"
          fill={COLOR[p.decision]}
          fillOpacity={p.index === active ? 0.16 : 0.07}
          className="transition-[fill-opacity] duration-200"
        />
      ))}
      {GRID.map((share) => (
        <line
          key={share}
          x1={x(share)}
          x2={x(share)}
          y1="0"
          y2={height}
          stroke={share === 0.5 ? "var(--etch)" : "var(--hairline)"}
          strokeDasharray={share === 0.5 ? undefined : "1 3"}
        />
      ))}
      {points.length > 1 && (
        <polyline
          points={points.map((p) => `${x(p.share)},${middle(p)}`).join(" ")}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      )}
      {points.map((p) => {
        const isActive = p.index === active
        return (
          <g key={p.index}>
            {isActive && (
              <circle
                cx={x(p.share)}
                cy={middle(p)}
                r="9"
                fill="none"
                stroke="var(--ink)"
                strokeOpacity="0.25"
              />
            )}
            <circle
              cx={x(p.share)}
              cy={middle(p)}
              r={isActive ? 5 : 3.5}
              fill={COLOR[p.decision]}
              stroke="var(--sheet)"
              strokeWidth="1.5"
            />
          </g>
        )
      })}
    </svg>
  )
}
