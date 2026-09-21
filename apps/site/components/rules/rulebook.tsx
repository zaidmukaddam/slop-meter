"use client"

import { extract } from "@slop/features"
import { RULES, type Rule, type Tier } from "@slop/rules"
import weights from "@slop/rules/weights.json"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { percent } from "@/lib/format"
import { cn } from "@/lib/utils"

type Measured = {
  weight: number
  fireRateHuman: number
  fireRateMachine: number
}

const MEASURED: Record<string, Measured | undefined> = weights.rules
const EVEN = 0.05

const TIERS: { id: Tier; name: string }[] = [
  { id: "lexical", name: "Words" },
  { id: "punctuation", name: "Punctuation" },
  { id: "statistical", name: "Rates" },
  { id: "structural", name: "Structure" },
  { id: "semantic", name: "Meaning" },
]
const TIER_NAME = Object.fromEntries(TIERS.map((t) => [t.id, t.name]))

const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

const matches = (rule: Rule, query: string) =>
  [
    rule.id,
    rule.name,
    rule.detect,
    rule.fix,
    rule.example?.tell ?? "",
    rule.example?.plain ?? "",
  ].some((field) => field.toLowerCase().includes(query))

function tellSpans(rule: Rule): [number, number][] {
  if (!rule.example || rule.tier === "statistical") return []
  return (
    extract(rule.example.tell).rules.find((r) => r.id === rule.id)?.spans ?? []
  )
}
const SPANS = Object.fromEntries(
  RULES.map((rule) => [rule.id, tellSpans(rule)])
)

export function Rulebook() {
  const [query, setQuery] = useState("")
  const [tier, setTier] = useState<Tier | "all">("all")
  const q = query.trim().toLowerCase()
  const shown = RULES.filter(
    (rule) => (tier === "all" || rule.tier === tier) && (!q || matches(rule, q))
  )

  useEffect(() => {
    const reveal = () => {
      if (RULES.some((rule) => `#${rule.id}` === location.hash)) {
        setQuery("")
        setTier("all")
      }
    }
    addEventListener("hashchange", reveal)
    return () => removeEventListener("hashchange", reveal)
  }, [])

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-hairline pb-5">
        <div className="min-w-0">
          <ToggleGroup
            value={[tier]}
            onValueChange={(value) =>
              value[0] && setTier(value[0] as Tier | "all")
            }
            aria-label="Kind of tell"
            className="flex-wrap gap-y-2"
          >
            {[{ id: "all" as const, name: "All" }, ...TIERS].map((t) => (
              <ToggleGroupItem
                key={t.id}
                value={t.id}
                className="h-8 shrink-0 gap-1.5 rounded-full border border-hairline px-3.5 text-[13px] data-pressed:border-ink data-pressed:bg-transparent pointer-coarse:h-10"
              >
                {t.name}
                <span className="font-mono text-[10px] text-graphite tabular-nums">
                  {t.id === "all"
                    ? RULES.length
                    : RULES.filter((rule) => rule.tier === t.id).length}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Input
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Search the rules"
          placeholder="Search rules and examples"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 w-full rounded-full border-hairline bg-sheet px-3.5 sm:w-64"
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {q || tier !== "all"
          ? `${shown.length} ${shown.length === 1 ? "rule" : "rules"} shown`
          : ""}
      </p>

      {shown.map((rule) => (
        <RuleEntry key={rule.id} rule={rule} />
      ))}

      {shown.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-[15px] text-graphite">
            No rule mentions "{query.trim()}"
            {tier !== "all" && ` under ${TIER_NAME[tier].toLowerCase()}`}.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("")
              setTier("all")
            }}
            className="mt-5 h-9 rounded-full border-hairline bg-transparent px-4"
          >
            Show all rules
          </Button>
        </div>
      )}
    </div>
  )
}

function RuleEntry({ rule }: { rule: Rule }) {
  const measured = MEASURED[rule.id]
  return (
    <article
      id={rule.id}
      aria-labelledby={`${rule.id}-name`}
      className="grid scroll-mt-6 gap-x-14 gap-y-6 border-b border-hairline py-9 lg:grid-cols-[17rem_minmax(0,1fr)] lg:py-12"
    >
      <header>
        <p className="font-mono text-[11px] text-graphite">
          {rule.id} · {TIER_NAME[rule.tier]}
        </p>
        <h2
          id={`${rule.id}-name`}
          className="mt-2 text-xl/snug font-semibold text-balance [font-stretch:108%]"
        >
          {capital(rule.name)}
        </h2>
        <p className="mt-2 text-[15px]/relaxed text-pretty text-graphite">
          {capital(rule.detect)}.
        </p>
        <Lean measured={measured} statistical={rule.tier === "statistical"} />
      </header>

      <div className="min-w-0">
        {rule.example ? (
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            <Specimen label="With the tell">
              <Marked text={rule.example.tell} spans={SPANS[rule.id]} />
            </Specimen>
            <Specimen label="Without it">{rule.example.plain}</Specimen>
          </div>
        ) : (
          <p className="font-serif text-[17px]/[1.65] text-pretty text-graphite">
            {rule.tier === "statistical"
              ? "No one sentence shows this. It's a rate over the whole paragraph, so it only shows up in text long enough to count."
              : "The meter has no detector for this one, so there's nothing to mark. Watch for it yourself."}
          </p>
        )}
        <p className="mt-6 max-w-2xl text-[15px]/relaxed text-pretty">
          <span className="legend mr-2 text-[10px] font-semibold text-graphite">
            Fix
          </span>
          {capital(rule.fix)}.
        </p>
      </div>
    </article>
  )
}

function Specimen({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="legend text-[10px] font-semibold text-graphite">
        {label}
      </figcaption>
      <blockquote className="mt-2 font-serif text-[18px]/[1.6] text-pretty whitespace-pre-line">
        {children}
      </blockquote>
    </figure>
  )
}

function Marked({ text, spans }: { text: string; spans: [number, number][] }) {
  const parts: React.ReactNode[] = []
  let at = 0
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (start < at) continue
    parts.push(text.slice(at, start))
    parts.push(
      <mark
        key={start}
        className="rounded-[2px] bg-marker box-decoration-clone px-0.5 text-ink"
      >
        {text.slice(start, end)}
      </mark>
    )
    at = end
  }
  parts.push(text.slice(at))
  return parts
}

function Lean({
  measured,
  statistical,
}: {
  measured: Measured | undefined
  statistical: boolean
}) {
  if (!measured)
    return (
      <p className="mt-4 font-mono text-[11px]/5 text-graphite">
        Not scored: the meter doesn't use this rule
      </p>
    )
  const { weight } = measured
  const lean =
    Math.abs(weight) < EVEN
      ? { word: "About even", color: "text-graphite" }
      : weight > 0
        ? { word: "Leans machine", color: "text-machine" }
        : { word: "Leans human", color: "text-human" }
  return (
    <p className="mt-4 font-mono text-[11px]/5 text-graphite tabular-nums">
      <span className={cn("font-semibold", lean.color)}>{lean.word}</span>
      <br />
      {statistical
        ? "Measured on every paragraph"
        : `In ${percent(measured.fireRateMachine, 1)} of machine paragraphs, ${percent(measured.fireRateHuman, 1)} of human`}
    </p>
  )
}
