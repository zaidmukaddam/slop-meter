import { ENGLISH_FUNCTION_WORDS } from "./lexicons.ts"
import { RULE_EXTRACTORS } from "./rules.ts"
import { STYLE_NAMES, style } from "./style.ts"
import { type Span, type Word, parse } from "./text.ts"

export type { Span } from "./text.ts"
export type RuleHit = { id: string; value: number; spans: Span[] }
export type Features = {
  values: Float32Array
  rules: RuleHit[]
  words: number
  english: boolean
}

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
  return {
    values,
    rules,
    words: parsed.words.length,
    english: englishShare(parsed.words) >= ENGLISH_MIN_SHARE,
  }
}

export const ENGLISH_MIN_SHARE = 0.1

export function englishShare(text: string | Word[]): number {
  const words = typeof text === "string" ? parse(text).words : text
  if (!words.length) return 0
  let hits = 0
  for (const word of words) if (ENGLISH_FUNCTION_WORDS.has(word.lower)) hits++
  return hits / words.length
}

export function segment(text: string): string[] {
  const normal = text.replace(/\r\n?/g, "\n")
  return segmentSpans(normal).map(([start, end]) => normal.slice(start, end))
}

export function segmentSpans(text: string): Span[] {
  const spans: Span[] = []
  const breaks = /\n\s*\n/g
  let from = 0
  const take = (to: number) => {
    const chunk = text.slice(from, to)
    const trimmed = chunk.trim()
    if (/[A-Za-z]/.test(trimmed)) {
      const start = from + chunk.indexOf(trimmed)
      spans.push([start, start + trimmed.length])
    }
  }
  for (const match of text.matchAll(breaks)) {
    take(match.index)
    from = match.index + match[0].length
  }
  take(text.length)
  return spans
}
