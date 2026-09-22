import {
  DECISION_LABEL,
  type Score,
  Scorer,
  explain,
  isRead,
} from "@slop/model"
import manifest from "@slop/model/manifest.json" with { type: "json" }
import type { Label, Reading } from "../types/index.d.ts"
import weights from "./weights.ts"

let scorer: Promise<Scorer> | undefined

export const version: string = manifest.version

function reading(text: string, s: Score): Reading {
  const read = isRead(s)
  return {
    text,
    words: s.words,
    verdict: s.localDecision,
    label: DECISION_LABEL[s.localDecision] as Label,
    confidence: s.localP,
    probabilities: { ...s.probs },
    reasons: read
      ? explain(s).map(({ id, name, spans }) => ({ id, name, spans }))
      : [],
    skipped: s.tooShort ? "too-short" : s.notEnglish ? "not-english" : null,
  }
}

export async function score(paragraph: string): Promise<Reading> {
  scorer ??= Scorer.create(manifest, weights, { backend: "cpu" })
  const model = await scorer
  const text = paragraph.trim()
  return reading(text, model.score(text))
}

export async function scoreText(text: string): Promise<Reading[]> {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return Promise.all(paragraphs.map(score))
}
