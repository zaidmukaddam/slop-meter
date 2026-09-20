import names from "./names.json" with { type: "json" }
import type { Tier } from "./index.ts"

export const RULE_NAMES = names as Record<string, { name: string; tier: Tier }>

const MAX_TELL_CHARS = 48

export function tellSpans(rule: {
  id: string
  spans: [number, number][]
}): [number, number][] {
  if (RULE_NAMES[rule.id]?.tier === "statistical") return []
  return rule.spans.filter(([start, end]) => end - start <= MAX_TELL_CHARS)
}
