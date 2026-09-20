import {
  DIAL_ORDER as ORDER,
  DECISION_LABEL as LABEL,
  type ModelClass,
} from "@slop/model"
import { COLOR } from "@/lib/decisions"
import type { Bin } from "@/lib/server/calibrate"

const SIZE = 240
const PAD = 30
const TICKS = [0, 0.5, 1]

const at = (v: number) => PAD + v * (SIZE - PAD * 2)
const up = (v: number) => SIZE - PAD - v * (SIZE - PAD * 2)

export function ReliabilityCharts({
  reliability,
}: {
  reliability: Record<ModelClass, Bin[]>
}) {
  return (
    <div className="grid gap-x-10 gap-y-12 sm:grid-cols-3">
      {ORDER.map((c) => (
        <Chart key={c} answer={c} bins={reliability[c]} />
      ))}
    </div>
  )
}

function Chart({ answer, bins }: { answer: ModelClass; bins: Bin[] }) {
  const largest = Math.max(...bins.map((bin) => bin.n))
  const worst = bins.reduce((a, b) =>
    Math.abs(b.observed - b.predicted) > Math.abs(a.observed - a.predicted)
      ? b
      : a
  )
  return (
    <figure>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${LABEL[answer]}: the widest gap is at ${Math.round(worst.predicted * 100)}% given, ${Math.round(worst.observed * 100)}% true.`}
        className="w-full overflow-visible"
      >
        <rect
          x={PAD}
          y={PAD}
          width={SIZE - PAD * 2}
          height={SIZE - PAD * 2}
          fill="var(--sheet)"
          stroke="var(--hairline)"
        />
        {TICKS.map((t) => (
          <g key={t}>
            <text
              x={at(t)}
              y={SIZE - PAD + 16}
              textAnchor="middle"
              fontSize="8"
              fill="var(--graphite)"
              className="font-mono"
            >
              {t * 100}
            </text>
            <text
              x={PAD - 8}
              y={up(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="8"
              fill="var(--graphite)"
              className="font-mono"
            >
              {t * 100}
            </text>
          </g>
        ))}
        <line
          x1={at(0)}
          y1={up(0)}
          x2={at(1)}
          y2={up(1)}
          stroke="var(--etch)"
          strokeDasharray="3 4"
        />
        <polyline
          points={bins
            .map((b) => `${at(b.predicted)},${up(b.observed)}`)
            .join(" ")}
          fill="none"
          stroke={COLOR[answer]}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {bins.map((b) => (
          <circle
            key={b.bin}
            cx={at(b.predicted)}
            cy={up(b.observed)}
            r={1.75 + 3.25 * Math.sqrt(b.n / largest)}
            fill={COLOR[answer]}
            stroke="var(--sheet)"
            strokeWidth="1.25"
          />
        ))}
      </svg>
      <figcaption className="legend mt-3 flex items-center gap-2 text-[11px] font-semibold">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: COLOR[answer] }}
        />
        {LABEL[answer]}
      </figcaption>
    </figure>
  )
}
