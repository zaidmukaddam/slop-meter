"use client"

import { Numbers } from "@sfinterface/numbers"
import "@sfinterface/numbers/styles.css"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type Point = {
  tau: number
  accuracyDecided: number | null
  falseMachineRateOnHuman: number
}

const PEOPLE = 1000
const ORDER = shuffled(PEOPLE)

function shuffled(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  let seed = 20260920
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

interface FlagFieldProps {
  curve: Point[]
  shipped: number
}

export function FlagField({ curve, shipped }: FlagFieldProps) {
  const [sure, setSure] = useState(shipped)
  const lo = curve[0].tau
  const hi = curve[curve.length - 1].tau
  const point = curve.reduce((a, b) =>
    Math.abs(b.tau - sure) < Math.abs(a.tau - sure) ? b : a
  )
  const flagged = Math.round(point.falseMachineRateOnHuman * PEOPLE)
  const moved = Math.abs(sure - shipped) > 1e-9

  return (
    <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <figure className="min-w-0">
        <div
          role="img"
          aria-label={`Of 1,000 paragraphs people wrote, ${flagged} would be wrongly called machine-ish at this setting.`}
          className="grid grid-cols-[repeat(40,minmax(0,1fr))] gap-[2px] sm:grid-cols-[repeat(50,minmax(0,1fr))] sm:gap-1"
        >
          {ORDER.map((rank, i) => (
            <span
              key={i}
              className={cn(
                "aspect-square rounded-full",
                rank < flagged ? "bg-machine" : "scale-[0.6] bg-etch"
              )}
            />
          ))}
        </div>
        <figcaption className="mt-4 text-[13px] text-pretty text-graphite">
          1,000 paragraphs written by people. The lit ones get wrongly called
          machine-ish.
        </figcaption>
        <div className="mt-6 max-w-md sm:mt-8">
          <label
            htmlFor="sure"
            className="legend block text-[10px] font-semibold text-balance text-graphite"
          >
            How sure it must be before it says machine-ish
          </label>
          <div className="mt-4 flex items-center gap-4">
            <Slider
              id="sure"
              aria-label="How sure it must be before it says machine-ish"
              min={lo}
              max={hi}
              step={0.01}
              value={[sure]}
              onValueChange={(value) =>
                setSure(Array.isArray(value) ? value[0] : value)
              }
            />
            <span className="w-12 text-right font-mono text-sm tabular-nums">
              {Math.round(point.tau * 100)}%
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => setSure(shipped)}
            className={cn(
              "mt-5 h-8 rounded-full border-hairline bg-transparent px-3.5 text-[13px]",
              !moved && "invisible"
            )}
          >
            Back to {Math.round(shipped * 100)}%, where it&apos;s set
          </Button>
        </div>
      </figure>

      <dl
        aria-live="polite"
        className="grid grid-cols-2 gap-x-6 max-lg:order-first lg:block lg:space-y-7"
      >
        <div className="flex flex-col-reverse gap-1.5">
          <dt className="text-sm text-balance text-graphite">
            of those 1,000 people wrongly flagged
          </dt>
          <dd className="font-mono text-5xl leading-none font-light tracking-tight text-machine">
            <Numbers value={flagged} />
          </dd>
        </div>
        <div className="flex flex-col-reverse gap-1.5">
          <dt className="text-sm text-balance text-graphite">
            right when it gives a verdict
          </dt>
          <dd className="font-mono text-5xl leading-none font-light tracking-tight">
            {point.accuracyDecided === null ? (
              "–"
            ) : (
              <Numbers
                value={point.accuracyDecided}
                format={{ style: "percent", maximumFractionDigits: 0 }}
              />
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
