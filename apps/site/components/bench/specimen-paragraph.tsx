"use client"

import { DECISION_LABEL as LABEL, RULE_FIRED, type Score } from "@slop/model"
import { tellSpans } from "@slop/rules/names"
import { useEffect, useRef } from "react"
import { percent } from "@/lib/format"
import { dimMarkdownSyntax, underlineTells } from "@/lib/highlight"
import { cn } from "@/lib/utils"

const HEADING = /^#{1,6}\s/

interface SpecimenParagraphProps {
  index: number
  text: string
  score: Score | undefined
  active: boolean
  dimmed: boolean
  register: (element: HTMLElement | null) => void
  onPoint: (pointing: boolean) => void
}

export function SpecimenParagraph({
  index,
  text,
  score,
  active,
  dimmed,
  register,
  onPoint,
}: SpecimenParagraphProps) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const scorable = !!score && !score.tooShort
  const tells = scorable
    ? score.rules.filter((rule) => rule.value > RULE_FIRED).flatMap(tellSpans)
    : []

  useEffect(() => dimMarkdownSyntax(textRef.current), [text])
  useEffect(() => underlineTells(textRef.current, tells), [tells])

  return (
    <div
      ref={register}
      role="listitem"
      data-index={index}
      tabIndex={scorable ? 0 : undefined}
      aria-current={active || undefined}
      aria-describedby={scorable ? `verdict-${index}` : undefined}
      onMouseEnter={() => scorable && onPoint(true)}
      onMouseLeave={() => onPoint(false)}
      onFocus={() => scorable && onPoint(true)}
      onBlur={() => onPoint(false)}
      className="max-w-(--measure) rounded-sm py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-4 focus-visible:ring-offset-sheet"
    >
      <p
        ref={textRef}
        className={cn(
          "whitespace-pre-wrap transition-colors duration-200",
          dimmed ? "text-graphite" : "text-ink",
          HEADING.test(text)
            ? "font-sans text-xl/snug font-semibold"
            : "font-serif text-[18px]/[1.7]"
        )}
      >
        {text}
      </p>
      {scorable && (
        <span id={`verdict-${index}`} className="sr-only">
          {score.localDecision === "unsure"
            ? `${LABEL.unsure}, leans ${LABEL[score.top]} at ${percent(score.localP)}`
            : `${LABEL[score.localDecision]}, ${percent(score.localP)}`}
        </span>
      )}
    </div>
  )
}
