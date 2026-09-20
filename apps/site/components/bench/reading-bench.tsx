"use client"

import { segment } from "@slop/features"
import { explain } from "@slop/model"
import { tellSpans } from "@slop/rules/names"
import { rise } from "cube-motion"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Dial } from "@/components/meter/dial"
import { Readout } from "@/components/meter/readout"
import { Button } from "@/components/ui/button"
import { machineShare } from "@/lib/decisions"
import { EXAMPLES, TEXT_IDS } from "@/lib/examples"
import { highlightSpans } from "@/lib/highlight"
import { useScorer } from "@/lib/model"
import { featuresFor, request, useSharper } from "@/lib/sharper"
import { cn } from "@/lib/utils"
import { Distribution } from "./distribution"
import { type Fingerprint, InputSelector } from "./input-selector"
import { MarginNotes } from "./margin-notes"
import { OwnTextEditor } from "./own-text-editor"
import { ModelChoice } from "./model-choice"
import { SpecimenParagraph } from "./specimen-paragraph"
import { Trace, type TracePoint } from "./trace"

const textParam = parseAsStringLiteral(TEXT_IDS).withDefault(TEXT_IDS[0])

type Row = { top: number; bottom: number }
type Geometry = { strip: number; height: number; rows: Record<number, Row> }

const EXAMPLE_PARAGRAPHS = EXAMPLES.flatMap((e) => segment(e.text))
const READING_LINE = 38

export function ReadingBench() {
  const { scorer, error } = useScorer()
  const sharper = useSharper()
  const [textId, setTextId] = useQueryState("text", textParam)
  const [ownText, setOwnText] = useState("")
  const [editing, setEditing] = useState(true)
  const [reading, setReading] = useState<number | null>(null)
  const [pointed, setPointed] = useState<number | null>(null)
  const [geometry, setGeometry] = useState<Geometry>({
    strip: 0,
    height: 0,
    rows: {},
  })
  const headRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const elements = useRef(new Map<number, HTMLElement>())

  const example = EXAMPLES.find((e) => e.id === textId)
  const showEditor = !example && (editing || !ownText.trim())
  const shown = useRef({ textId, editor: showEditor })
  const paragraphs = segment(example ? example.text : ownText)
  const scoreOf = (p: string) => scorer?.score(p, featuresFor(sharper, p))
  const scores = paragraphs.map(scoreOf)
  const scored = scores.flatMap((s, i) => (s && !s.tooShort ? [i] : []))
  const active = showEditor
    ? scored.at(-1)
    : [pointed, reading, scored[0]].find(
        (i): i is number => i != null && scored.includes(i)
      )
  const score = active === undefined ? undefined : scores[active]
  const reasons = score ? explain(score) : []

  const fingerprints: Record<string, Fingerprint | undefined> = {}
  if (scorer) {
    for (const id of TEXT_IDS) {
      const text = EXAMPLES.find((e) => e.id === id)?.text ?? ownText
      fingerprints[id] = segment(text)
        .map((p) => scoreOf(p)!)
        .filter((s) => !s.tooShort)
        .map((s) => ({ words: s.words, decision: s.localDecision }))
    }
  }

  useEffect(() => {
    if (sharper.status !== "on") return
    const onShow = showEditor ? [] : segment(example ? example.text : ownText)
    request([...EXAMPLE_PARAGRAPHS, ...onShow])
  }, [sharper.status, showEditor, example, ownText])

  useEffect(() => {
    const line = READING_LINE
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setReading(Number((entry.target as HTMLElement).dataset.index))
          }
        }
      },
      { rootMargin: `-${line}% 0px -${99 - line}% 0px` }
    )
    for (const element of elements.current.values()) observer.observe(element)
    return () => observer.disconnect()
  }, [textId, paragraphs.length, showEditor])

  useLayoutEffect(() => {
    const list = listRef.current
    const strip = stripRef.current
    if (!list || !strip) return
    const measure = () => {
      const top = list.getBoundingClientRect().top
      const rows: Record<number, Row> = {}
      for (const [i, element] of elements.current) {
        const box = element.getBoundingClientRect()
        rows[i] = { top: box.top - top, bottom: box.bottom - top }
      }
      setGeometry({ strip: strip.offsetWidth, height: list.offsetHeight, rows })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [textId, paragraphs.length, showEditor, scorer])

  useLayoutEffect(() => {
    if (shown.current.textId === textId && shown.current.editor === showEditor)
      return
    shown.current = { textId, editor: showEditor }
    if (listRef.current) rise(listRef.current, { targets: "children" })
    else if (editorRef.current) rise(editorRef.current)
  }, [textId, showEditor])

  useEffect(() => {
    const element =
      active === undefined || showEditor
        ? null
        : (elements.current.get(active)?.querySelector("p") ?? null)
    highlightSpans(element, reasons.flatMap(tellSpans))
    return () => highlightSpans(null, [])
  }, [active, reasons, showEditor])

  function chooseText(id: string) {
    setTextId(id)
    setReading(null)
    setPointed(null)
    const paper = paperRef.current?.getBoundingClientRect().top
    const head = headRef.current?.getBoundingClientRect().bottom
    if (paper !== undefined && head !== undefined && paper < head) {
      window.scrollBy({ top: paper - head - 24 })
    }
  }

  const trace: TracePoint[] = scored.flatMap((i) => {
    const row = geometry.rows[i]
    const s = scores[i]!
    return row
      ? [
          {
            index: i,
            ...row,
            share: machineShare(s),
            decision: s.localDecision,
          },
        ]
      : []
  })

  const caption =
    score && active !== undefined
      ? `${showEditor ? "Your draft" : `¶ ${active + 1} of ${paragraphs.length}`} · ${score.words} words`
      : ""

  return (
    <div
      style={
        {
          "--reading-line": `${READING_LINE}dvh`,
          "--measure": "600px",
          "--dial-w": "300px",
        } as React.CSSProperties
      }
    >
      <div
        ref={headRef}
        className="sticky top-0 z-20 border-b border-hairline bg-bench"
      >
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[10rem_minmax(0,1fr)] items-center gap-x-5 px-5 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_var(--dial-w)_minmax(0,1fr)] lg:gap-x-14 lg:py-5">
          <ModelChoice
            legend={<PanelLegend className="mb-0">Model</PanelLegend>}
            className="hidden lg:flex"
          />
          <Dial
            value={score ? machineShare(score) : null}
            label={
              score
                ? `Needle at ${Math.round(machineShare(score) * 100)} percent machine-shaped`
                : "Needle at rest"
            }
            className="w-full"
          />
          <div>
            <PanelLegend className="max-lg:hidden">Reading</PanelLegend>
            <Readout
              score={score}
              loading={!scorer}
              minWords={scorer?.manifest.minWords ?? 0}
              caption={caption}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
        <div className="pt-5 lg:pt-8">
          <PanelLegend>Input</PanelLegend>
          <InputSelector
            value={textId}
            onValueChange={chooseText}
            fingerprints={fingerprints}
          />
        </div>
        <ModelChoice
          legend={
            <p className="legend text-[10px] font-semibold text-graphite">
              Model
            </p>
          }
          className="mt-4 lg:hidden"
        />

        {error && (
          <p role="alert" className="mt-6 text-sm text-destructive">
            The model didn't load ({error}). Reload the page to try again.
          </p>
        )}

        <article
          ref={paperRef}
          aria-label="Text being read"
          className="relative isolate -mx-5 mt-5 border-y border-hairline bg-sheet px-4 py-6 has-[textarea:focus-visible]:border-graphite sm:mx-0 sm:rounded-md sm:border-x sm:px-8 sm:py-8 lg:mt-8 lg:px-12 lg:py-10"
        >
          <div
            aria-hidden
            className="paper-grain pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
          />
          <header className="mb-6 grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-hairline pb-5 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-6">
            <p
              aria-hidden
              className={cn(
                "flex items-end justify-between self-end font-mono text-[10px] text-graphite",
                showEditor && "invisible"
              )}
            >
              <span className="text-human">0</span>
              <span className="max-sm:hidden">50</span>
              <span className="text-machine">100</span>
            </p>
            <div className="grid gap-x-10 gap-y-3 lg:grid-cols-[minmax(0,var(--measure))_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="max-w-md font-mono text-[11px] leading-5 text-pretty text-graphite">
                  {example
                    ? example.source
                    : showEditor
                      ? "Your text stays in this tab. Leave a blank line between paragraphs."
                      : "Your text. It stays in this tab."}
                </p>
                {!showEditor && <Distribution scores={scores} />}
              </div>
              <div className="self-end">
                {example ? (
                  <p className="hidden font-mono text-[11px] leading-5 text-pretty text-graphite lg:block">
                    The needle reads the paragraph at the arrow. Hover or tab to
                    another paragraph to read that one.
                  </p>
                ) : (
                  !showEditor && (
                    <Button
                      variant="outline"
                      onClick={() => setEditing(true)}
                      className="h-8 rounded-full border-hairline bg-transparent px-3.5 text-[13px]"
                    >
                      Edit text
                    </Button>
                  )
                )}
              </div>
            </div>
          </header>

          {showEditor ? (
            <div ref={editorRef}>
              <OwnTextEditor
                value={ownText}
                onChange={setOwnText}
                onRead={() => setEditing(false)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-6">
              <div ref={stripRef} className="relative">
                <div className="absolute inset-0">
                  <Trace
                    points={trace}
                    width={geometry.strip}
                    height={geometry.height}
                    active={active}
                  />
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none sticky top-(--reading-line) z-10 h-0"
                >
                  <span className="absolute -left-3 block size-0 -translate-y-1/2 border-y-[5px] border-l-[6px] border-y-transparent border-l-ink sm:-left-5" />
                  <span className="absolute inset-x-0 border-t border-dashed border-ink/40" />
                </div>
              </div>
              <div
                ref={listRef}
                role="list"
                aria-label="Paragraphs"
                className="relative"
              >
                {paragraphs.map((text, i) => (
                  <SpecimenParagraph
                    key={`${textId}-${i}`}
                    index={i}
                    text={text}
                    score={scores[i]}
                    active={i === active}
                    dimmed={active !== undefined && i !== active}
                    register={(element) => {
                      if (element) elements.current.set(i, element)
                      else elements.current.delete(i)
                    }}
                    onPoint={(on) =>
                      setPointed((current) => {
                        if (on) return i
                        return current === i ? null : current
                      })
                    }
                  />
                ))}
                {score && active !== undefined && geometry.rows[active] && (
                  <MarginNotes
                    key={`${textId}-${active}`}
                    reasons={reasons}
                    top={geometry.rows[active].top}
                    className="max-lg:sr-only lg:left-[calc(var(--measure)+2.5rem)]"
                  />
                )}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

function PanelLegend({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "legend mb-3 flex items-center gap-3 text-[10px] font-semibold text-graphite",
        className
      )}
    >
      {children}
      <span aria-hidden className="h-px flex-1 bg-hairline" />
    </p>
  )
}
