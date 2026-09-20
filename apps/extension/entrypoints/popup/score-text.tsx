import { segment } from "@slop/features"
import {
  DECISION_LABEL,
  type Score,
  type Scorer,
  percent,
  shownP,
} from "@slop/model"
import { useState } from "react"
import { loadScorer, sharpen } from "../../shared/model"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const SNIPPET_WORDS = 6
let scorer: Promise<Scorer> | null = null

type Result = { paragraphs: string[]; scores: Score[] }

export function ScoreText({ lm }: { lm: boolean }) {
  const [text, setText] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [scoring, setScoring] = useState(false)

  async function score() {
    const paragraphs = segment(text)
    if (!paragraphs.length) return
    setScoring(true)
    scorer ??= loadScorer()
    const loaded = await scorer
    setResult({ paragraphs, scores: paragraphs.map((p) => loaded.score(p)) })
    if (lm) {
      const sharper = await sharpen(loaded, paragraphs)
      if (Array.isArray(sharper)) setResult({ paragraphs, scores: sharper })
    }
    setScoring(false)
  }

  return (
    <section aria-labelledby="score-title" className="space-y-2">
      <h2
        id="score-title"
        className="legend text-[10px] font-semibold text-graphite"
      >
        Score text
      </h2>
      <Textarea
        aria-label="Text to score"
        placeholder="Paste some writing here."
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) score()
        }}
        className="max-h-40 text-xs"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-pretty text-graphite">
          Scored on this device. Leave a blank line between paragraphs.
        </p>
        <Button
          size="sm"
          onClick={score}
          disabled={!text.trim() || scoring}
          className="shrink-0"
        >
          Score
        </Button>
      </div>
      {result && (
        <ul aria-live="polite" className="space-y-1 text-xs">
          {result.scores.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: `var(--${s.localDecision})` }}
              />
              <span className="min-w-0 flex-1 truncate text-graphite">
                {result.paragraphs[i]
                  .split(/\s+/)
                  .slice(0, SNIPPET_WORDS)
                  .join(" ")}
              </span>
              <span className="shrink-0 font-mono tabular-nums">
                {s.tooShort
                  ? "too short"
                  : s.notEnglish
                    ? "not English"
                    : `${DECISION_LABEL[s.localDecision]} ${percent(shownP(s.localP))}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
