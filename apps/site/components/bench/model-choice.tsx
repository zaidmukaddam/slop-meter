"use client"

import { useEffect } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  type SharperState,
  resume,
  turnOff,
  turnOn,
  useSharper,
} from "@/lib/sharper"
import { cn } from "@/lib/utils"

type Model = "standard" | "sharper"

function badge(s: SharperState): string | null {
  if (s.status === "loading")
    return s.progress < 1 ? `${Math.round(s.progress * 100)}%` : "starting"
  if (s.status === "on") return null
  return "125 MB"
}

function failure(s: SharperState): string | null {
  if (s.status !== "failed") return null
  return s.error?.retry
    ? `Sharper couldn't start: ${s.error.message}. Choose it to try again.`
    : `Sharper can't run here. ${s.error?.message}.`
}

export function ModelChoice({
  legend,
  className,
}: {
  legend: React.ReactNode
  className?: string
}) {
  const sharper = useSharper()
  useEffect(resume, [])
  const model: Model =
    sharper.status === "on" || sharper.status === "loading"
      ? "sharper"
      : "standard"
  const choose = (next: Model) => (next === "sharper" ? turnOn() : turnOff())
  const error = failure(sharper)
  const size = badge(sharper)

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
    >
      {legend}
      <ToggleGroup
        value={[model]}
        onValueChange={(value) => value[0] && choose(value[0] as Model)}
        aria-label="Model"
      >
        <ToggleGroupItem
          value="standard"
          className="h-7 rounded-full border border-hairline px-3 text-[13px] data-pressed:border-ink data-pressed:bg-transparent"
        >
          Standard
        </ToggleGroupItem>
        <ToggleGroupItem
          value="sharper"
          title="Adds a small language model. It downloads once, runs in this tab, and says can't tell less often."
          className="h-7 gap-1.5 rounded-full border border-hairline px-3 text-[13px] data-pressed:border-ink data-pressed:bg-transparent"
        >
          Sharper
          {size && (
            <span className="font-mono text-[10px] text-graphite tabular-nums">
              {size}
            </span>
          )}
        </ToggleGroupItem>
      </ToggleGroup>
      <p
        aria-live="polite"
        className={cn(
          "basis-full font-mono text-[11px] leading-5 text-pretty text-destructive select-text",
          !error && "sr-only"
        )}
      >
        {error ?? (sharper.status === "on" ? "Sharper is on." : "")}
      </p>
    </div>
  )
}
