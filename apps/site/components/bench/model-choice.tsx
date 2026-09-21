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

/** What each model is and does, worked out on the server from the manifests and the
 *  dated reports, so the panel never states a number the reports don't. */
export type ModelFacts = Record<
  Model,
  { spec: string; short: string; note: string }
>

const NAME: Record<Model, string> = { standard: "Standard", sharper: "Sharper" }
const DOWNLOAD = "125 MB"

/** Loading has two halves, fetching and starting, and only the first is a download. */
const fetching = (s: SharperState) =>
  s.status === "loading" && !s.held && s.progress < 1

function badge(s: SharperState): string | null {
  if (s.status === "on") return null
  if (s.status !== "loading") return s.held ? "saved" : DOWNLOAD
  return fetching(s) ? `${Math.round(s.progress * 100)}%` : "starting"
}

/** What is happening right now, in the phase where people otherwise wonder
 *  whether it is downloading 125 MB all over again. It isn't. */
function note(s: SharperState): string | null {
  if (s.status === "failed") {
    return s.error?.retry
      ? `Sharper couldn't start: ${s.error.message}. Choose it to try again.`
      : `Sharper can't run here. ${s.error?.message}.`
  }
  if (s.status !== "loading") return null
  if (fetching(s)) {
    return `Downloading the language model, ${Math.round(s.progress * 100)}% of ${DOWNLOAD}. It stays in this browser afterwards.`
  }
  return s.held
    ? "Starting the language model. It's already in this browser, so nothing is being downloaded."
    : "Downloaded. Starting the language model, which takes a few seconds."
}

function standing(s: SharperState): string {
  if (s.status === "loading") return fetching(s) ? "Downloading" : "Starting"
  if (s.status === "on") return "Language model running"
  if (s.status === "failed") return "Fell back to standard"
  return "Reads every paragraph"
}

interface ModelChoiceProps {
  legend: React.ReactNode
  className?: string
  /** "inline" is the pair of pills. "panel" is the instrument beside the dial, built
   *  like the reading on the dial's other side so the two columns carry equal weight.
   *  "bar" is the same instrument at the height of the pinned header. */
  variant?: "inline" | "panel" | "bar"
  facts?: ModelFacts
}

export function ModelChoice({
  legend,
  className,
  variant = "inline",
  facts,
}: ModelChoiceProps) {
  const sharper = useSharper()
  useEffect(resume, [])
  const model: Model =
    sharper.status === "on" || sharper.status === "loading"
      ? "sharper"
      : "standard"
  const choose = (next: Model) => (next === "sharper" ? turnOn() : turnOff())
  const said = note(sharper)
  const size = badge(sharper)
  // The pinned bar has one row to itself: the size is on the full panel, and up here
  // the badge earns its width only while it is counting something.
  const pinned = variant === "bar"
  const loading = sharper.status === "loading"

  const toggle = (
    <ToggleGroup
      value={[model]}
      onValueChange={(value) => value[0] && choose(value[0] as Model)}
      aria-label="Model"
      className={cn(variant === "panel" && "w-full")}
    >
      {(["standard", "sharper"] as const).map((id) => (
        <ToggleGroupItem
          key={id}
          value={id}
          title={
            id === "standard"
              ? undefined
              : sharper.held
                ? "Adds a small language model, already downloaded to this browser. It runs in this tab and says can't tell less often."
                : `Adds a small language model. It downloads once (${DOWNLOAD}), runs in this tab, and says can't tell less often.`
          }
          className={cn(
            "gap-1.5 rounded-full border border-hairline data-pressed:border-ink data-pressed:bg-transparent",
            variant === "panel" && "h-9 flex-1 px-4 text-sm",
            variant === "bar" && "h-8 px-3.5 text-[13px]",
            variant === "inline" &&
              "h-7 px-3 text-[13px] pointer-coarse:h-10 pointer-coarse:px-4"
          )}
        >
          {NAME[id]}
          {id === "sharper" && size && (!pinned || loading) && (
            <span className="font-mono text-[10px] text-graphite tabular-nums">
              {size}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )

  if (variant === "bar") {
    return (
      <div className={cn("flex items-center gap-x-6", className)}>
        <div className="shrink-0">
          <p
            data-morph-to="name"
            className="text-[2rem] leading-none font-light tracking-[-0.03em] [font-stretch:112%]"
          >
            {NAME[model]}
          </p>
          <p
            data-fade-in
            className="mt-2 font-mono text-[12px] whitespace-nowrap text-graphite"
          >
            {facts?.[model].short}
          </p>
        </div>
        <div data-fade-in>{toggle}</div>
      </div>
    )
  }

  if (variant === "panel") {
    return (
      <div className={cn("min-w-0", className)}>
        <div data-fade>
          {legend}
          <p className="truncate font-mono text-[11px] text-graphite">
            {facts?.[model].spec}
          </p>
        </div>
        <p
          data-morph="name"
          className="mt-2 text-[3.25rem] leading-none font-light tracking-[-0.03em] [font-stretch:112%]"
        >
          {NAME[model]}
        </p>
        <p
          data-fade
          className="legend mt-2 flex items-center gap-2 text-[13px] font-semibold"
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              sharper.status === "failed" ? "bg-destructive" : "bg-ink"
            )}
          />
          {standing(sharper)}
        </p>
        <div data-fade className="mt-4">
          {toggle}
          <p
            aria-live="polite"
            className={cn(
              "mt-2 font-mono text-[11px] text-pretty select-text lg:min-h-[2lh] xl:min-h-0",
              sharper.status === "failed" ? "text-destructive" : "text-graphite"
            )}
          >
            {said ?? facts?.[model].note}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
    >
      {legend}
      {toggle}
      <p
        aria-live="polite"
        className={cn(
          "basis-full font-mono text-[11px] leading-5 text-pretty select-text",
          sharper.status === "failed" ? "text-destructive" : "text-graphite",
          !said && "sr-only"
        )}
      >
        {said ?? (sharper.status === "on" ? "Sharper is on." : "")}
      </p>
    </div>
  )
}
