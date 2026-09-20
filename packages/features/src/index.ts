import { RULE_EXTRACTORS } from "./rules.ts"
import { STYLE_NAMES, style } from "./style.ts"
import { type Span, parse } from "./text.ts"

export type { Span } from "./text.ts"
export type RuleHit = { id: string; value: number; spans: Span[] }
export type Features = { values: Float32Array; rules: RuleHit[]; words: number }

export const SPEC_VERSION = 5
export const RULE_FEATURE_IDS = Object.keys(RULE_EXTRACTORS).sort()
export const FEATURE_NAMES = [...RULE_FEATURE_IDS, ...STYLE_NAMES]
export const FEATURE_DIM = FEATURE_NAMES.length

export function extract(text: string): Features {
  const parsed = parse(text)
  const rules = RULE_FEATURE_IDS.map((id) => ({
    id,
    ...RULE_EXTRACTORS[id](parsed),
  }))
  const values = new Float32Array(FEATURE_DIM)
  values.set(
    rules.map((r) => r.value),
    0
  )
  values.set(style(parsed), rules.length)
  return { values, rules, words: parsed.words.length }
}

export function segment(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z]/.test(s))
}
