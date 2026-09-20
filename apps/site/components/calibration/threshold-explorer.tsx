"use client"

import { Numbers } from "@sfinterface/numbers"
import "@sfinterface/numbers/styles.css"
import { useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type Point = {
  tau: number
  unsureRate: number
  accuracyDecided: number | null
  falseMachineRateOnHuman: number
}
type Metric = "accuracyDecided" | "unsureRate" | "falseMachineRateOnHuman"
type Bar = "other" | "machine"

const SERIES: {
  key: Metric
  label: string
  legend: string
  color: string
  dash?: string
  digits: number
}[] = [
  {
    key: "accuracyDecided",
    label: "right when it makes a call",
    legend: "Right when it makes a call",
    color: "var(--ink)",
    digits: 0,
  },
  {
    key: "unsureRate",
    label: "of paragraphs get can't tell",
    legend: "Can't tell",
    color: "var(--unsure)",
    dash: "5 4",
    digits: 0,
  },
  {
    key: "falseMachineRateOnHuman",
    label: "of human paragraphs called machine-ish",
    legend: "Human text called machine-ish",
    color: "var(--machine)",
    digits: 1,
  },
]

const BARS: { id: Bar; name: string }[] = [
  { id: "machine", name: "Machine-ish bar" },
  { id: "other", name: "Human-ish and mixed bar" },
]

const WIDE = 720
const PAD = { left: 44, right: 12, top: 28, bottom: 34 }
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1]

interface ThresholdExplorerProps {
  curves: Record<Bar, Point[]>
  shipped: Record<Bar, number>
}

export function ThresholdExplorer({ curves, shipped }: ThresholdExplorerProps) {
  const [bar, setBar] = useState<Bar>("machine")
  const [at, setAt] = useState<Record<Bar, number>>(shipped)
  const [W, setWidth] = useState(WIDE)
  const H = Math.round(Math.min(300, Math.max(220, W * 0.42)))
  const figureRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const figure = figureRef.current
    if (!figure) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width))
    )
    observer.observe(figure)
    return () => observer.disconnect()
  }, [])

  const curve = curves[bar]
  const lo = curve[0].tau
  const hi = curve[curve.length - 1].tau
  const x = (t: number) =>
    PAD.left + ((t - lo) / (hi - lo)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom)
  const point = curve.reduce((a, b) =>
    Math.abs(b.tau - at[bar]) < Math.abs(a.tau - at[bar]) ? b : a
  )
  const moved = (Object.keys(shipped) as Bar[]).some(
    (b) => Math.abs(at[b] - shipped[b]) > 1e-9
  )
  const ticks = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9].filter((t) => t >= lo && t <= hi)

  return (
    <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <figure ref={figureRef} className="min-w-0">
        <ToggleGroup
          value={[bar]}
          onValueChange={(value) => value[0] && setBar(value[0] as Bar)}
          aria-label="Which bar to move"
          className="mb-6 flex-wrap"
        >
          {BARS.map((b) => (
            <ToggleGroupItem
              key={b.id}
              value={b.id}
              className="h-8 rounded-full border border-hairline px-3.5 text-[13px] data-pressed:border-ink data-pressed:bg-transparent"
            >
              {b.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Raising the ${BARS.find((b) => b.id === bar)!.name.toLowerCase()} from ${lo} to ${hi} makes calls more accurate and says can't tell on more paragraphs.`}
          className="w-full overflow-visible"
        >
          {Y_TICKS.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--hairline)"
              />
              <text
                x={PAD.left - 10}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="var(--graphite)"
                className="font-mono"
              >
                {v * 100}%
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <text
              key={t}
              x={x(t)}
              y={H - PAD.bottom + 20}
              textAnchor="middle"
              fontSize="11"
              fill="var(--graphite)"
              className="font-mono"
            >
              {t.toFixed(1)}
            </text>
          ))}

          <line
            x1={x(shipped[bar])}
            x2={x(shipped[bar])}
            y1={PAD.top - 12}
            y2={H - PAD.bottom}
            stroke="var(--etch)"
            strokeDasharray="2 3"
          />
          <text
            x={x(shipped[bar])}
            y={PAD.top - 18}
            textAnchor="middle"
            fontSize="10"
            fill="var(--graphite)"
            className="legend font-sans font-semibold"
          >
            Shipped
          </text>

          {SERIES.map((series) => (
            <polyline
              key={series.key}
              points={curve
                .filter((p) => p[series.key] !== null)
                .map((p) => `${x(p.tau)},${y(p[series.key]!)}`)
                .join(" ")}
              fill="none"
              stroke={series.color}
              strokeWidth="1.75"
              strokeDasharray={series.dash}
              strokeLinejoin="round"
            />
          ))}

          <line
            x1={x(point.tau)}
            x2={x(point.tau)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--ink)"
          />
          {SERIES.map((series) =>
            point[series.key] === null ? null : (
              <circle
                key={series.key}
                cx={x(point.tau)}
                cy={y(point[series.key]!)}
                r="4"
                fill={series.color}
                stroke="var(--bench)"
                strokeWidth="2"
              />
            )
          )}
        </svg>

        <div
          className="mt-2"
          style={{ paddingLeft: PAD.left, paddingRight: PAD.right }}
        >
          <Slider
            aria-label={BARS.find((b) => b.id === bar)!.name}
            min={lo}
            max={hi}
            step={0.01}
            value={[at[bar]]}
            onValueChange={(value) =>
              setAt((current) => ({
                ...current,
                [bar]: Array.isArray(value) ? value[0] : value,
              }))
            }
          />
        </div>
        <figcaption className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-graphite">
          {SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-2">
              <svg aria-hidden width="20" height="6">
                <line
                  x1="0"
                  x2="20"
                  y1="3"
                  y2="3"
                  stroke={series.color}
                  strokeWidth="2"
                  strokeDasharray={series.dash}
                />
              </svg>
              {series.legend}
            </span>
          ))}
        </figcaption>
      </figure>

      <div aria-live="polite" className="lg:pt-14">
        <dl className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-[11px] tabular-nums">
          {BARS.map((b) => (
            <div key={b.id}>
              <dt className="legend text-[10px] font-semibold whitespace-nowrap text-graphite">
                {b.id === "machine" ? "Machine-ish" : "Human-ish and mixed"}
              </dt>
              <dd
                className={cn(
                  "mt-1",
                  b.id === bar ? "text-ink" : "text-graphite"
                )}
              >
                {at[b.id].toFixed(2)}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="mt-6 space-y-5">
          {SERIES.map((series) => (
            <div key={series.key} className="flex flex-col-reverse gap-1.5">
              <dt className="text-sm text-balance text-graphite">
                {series.label}
              </dt>
              <dd className="font-mono text-4xl leading-none font-light tracking-tight">
                {point[series.key] === null ? (
                  "–"
                ) : (
                  <Numbers
                    value={point[series.key]!}
                    format={{
                      style: "percent",
                      minimumFractionDigits: series.digits,
                      maximumFractionDigits: series.digits,
                    }}
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
        <Button
          variant="outline"
          onClick={() => setAt(shipped)}
          className={cn(
            "mt-7 h-8 rounded-full border-hairline bg-transparent px-3.5 text-[13px]",
            !moved && "invisible"
          )}
        >
          Reset to the shipped bars
        </Button>
      </div>
    </div>
  )
}
