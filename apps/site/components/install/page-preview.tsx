"use client"

import { segment } from "@slop/features"
import {
  DECISION_LABEL as LABEL,
  DIAL_ORDER,
  type Reason,
  type Score,
  cardNote,
  explain,
  percent,
  reasonCode,
  shownP,
} from "@slop/model"
import manifest from "@slop/model/manifest.json"
import { BrandMark } from "@/components/brand"
import { Skeleton } from "@/components/ui/skeleton"
import { COLOR, confidenceOpacity } from "@/lib/decisions"
import { EXAMPLES } from "@/lib/examples"
import { useScorer } from "@/lib/model"

const plain = (text: string) => text.replace(/\*\*|^#+\s*/g, "")

const reply = segment(EXAMPLES.find((e) => e.id === "machine-reply")!.text)
const TITLE = "How do I get better at cooking at home?"
const BODY = reply
  .filter((p) => p.split(/\s+/).length >= manifest.minWords)
  .slice(0, 3)

export function PagePreview() {
  const { scorer } = useScorer()
  const scores = BODY.map((p) => scorer?.score(p))
  const open =
    scores.find((s) => s && s.localDecision !== "unsure") ?? scores[0]
  const reasons = open ? explain(open) : []

  return (
    <figure
      role="img"
      aria-label="A web page with a small colored lamp beside each paragraph, and the card that opens when you hover one: its call, the odds, and the rules behind it."
      className="overflow-hidden rounded-lg border border-hairline bg-sheet"
    >
      <div
        aria-hidden
        className="flex items-center gap-3 border-b border-hairline px-4 py-2.5"
      >
        <span className="min-w-0 flex-1 truncate rounded-full bg-muted px-3 py-1 font-mono text-[11px] text-graphite">
          example.com/cooking
        </span>
        <BrandMark className="size-4 shrink-0" />
      </div>
      <div
        aria-hidden
        className="grid gap-x-10 gap-y-8 p-5 sm:p-10 lg:grid-cols-[minmax(0,1fr)_17rem]"
      >
        <article className="max-w-xl">
          <h3 className="text-xl/snug font-semibold text-balance">{TITLE}</h3>
          {BODY.map((text, i) => {
            const score = scores[i]
            return (
              <div key={i} className="relative mt-4 pl-5">
                <span
                  className="absolute top-[7px] left-0 size-[7px] rounded-full"
                  style={{
                    background: score
                      ? COLOR[score.localDecision]
                      : "var(--muted)",
                    opacity: score ? confidenceOpacity(score.localP) : 1,
                  }}
                />
                <p className="font-serif text-[15px]/[1.65] whitespace-pre-line text-graphite">
                  {plain(text)}
                </p>
              </div>
            )
          })}
        </article>
        {open ? (
          <Card score={open} reasons={reasons} />
        ) : (
          <Skeleton className="h-72 w-full rounded-lg" />
        )}
      </div>
    </figure>
  )
}

function Card({ score, reasons }: { score: Score; reasons: Reason[] }) {
  const decided = score.localDecision !== "unsure"
  return (
    <div className="self-start rounded-lg border border-hairline bg-face p-4 text-[12px]/relaxed">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-hairline px-2 font-medium">
          <span
            className="size-1.5 rounded-full"
            style={{ background: COLOR[score.localDecision] }}
          />
          {LABEL[score.localDecision]}
        </span>
        {decided && (
          <span className="font-mono text-sm tabular-nums">
            {percent(shownP(score.localP))}
          </span>
        )}
      </div>
      <p className="mt-2 text-graphite">{cardNote(score)}</p>
      <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-muted">
        {DIAL_ORDER.map((c) => (
          <span
            key={c}
            style={{ width: `${score.probs[c] * 100}%`, background: COLOR[c] }}
          />
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px]">
        {DIAL_ORDER.map((c) => (
          <div key={c}>
            <dt className="text-graphite">{LABEL[c]}</dt>
            <dd className="tabular-nums">{percent(score.probs[c], 1)}</dd>
          </div>
        ))}
      </dl>
      <p className="legend mt-4 text-[10px] font-semibold text-graphite">
        Pushed by
      </p>
      <ul className="mt-1.5 space-y-1">
        {reasons.map((reason) => (
          <li key={reason.id} className="flex justify-between gap-3">
            <span className="truncate">{reason.name}</span>
            <code className="shrink-0 font-mono text-[10px] text-graphite">
              {reasonCode(reason)}
            </code>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        {["You're wrong", "Rewrite"].map((label) => (
          <span
            key={label}
            className="inline-flex h-7 items-center rounded-md border border-hairline px-2.5"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
