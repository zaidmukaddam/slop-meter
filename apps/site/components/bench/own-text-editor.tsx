"use client"

import { segmentSpans } from "@slop/features"
import { RULE_FIRED, type Score, isRead } from "@slop/model"
import { tellSpans } from "@slop/rules/names"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DOCUMENT_TYPES, readDocument } from "@/lib/document"
import { dimMarkdownSyntax, underlineTells } from "@/lib/highlight"
import { cn } from "@/lib/utils"

const DRAFT = "slop-meter:draft"
const SAVE_AFTER_MS = 400

/** Both layers set their text with exactly this, or the caret drifts off the words.
 *  The textarea's own text is transparent: what you see is the mirror beneath it,
 *  which is an ordinary element and so can be underlined, dimmed and measured. */
const TYPE =
  "font-serif text-[18px]/[1.7] tracking-normal whitespace-pre-wrap break-words [tab-size:4]"

interface OwnTextEditorProps {
  value: string
  onChange: (text: string) => void
  /** One per paragraph, in the order segmentSpans finds them. */
  scores: (Score | undefined)[]
  active: number | undefined
  minWords: number
  /** Each paragraph's element, so the bench can trace and annotate it like a read one. */
  register: (index: number, element: HTMLElement | null) => void
  /** The paragraph the caret is in, or null when it is between paragraphs. */
  onCaret: (index: number | null) => void
}

export function OwnTextEditor({
  value,
  onChange,
  scores,
  active,
  minWords,
  register,
  onCaret,
}: OwnTextEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const [over, setOver] = useState(false)
  const [file, setFile] = useState("")
  const [reading, setReading] = useState("")
  const [problem, setProblem] = useState("")
  const [cleared, setCleared] = useState("")

  const spans = segmentSpans(value)
  const words = value.match(/\S+/g)?.length ?? 0
  const short = scores.filter((score) => score?.tooShort).length

  // A draft outlives the tab. Restored once, into an empty box only.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT)
      if (saved && !value) onChange(saved)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (value) localStorage.setItem(DRAFT, value)
        else localStorage.removeItem(DRAFT)
      } catch {}
    }, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [value])

  function caret() {
    const at = field.current?.selectionStart ?? 0
    const index = spans.findIndex(([start, end]) => at >= start && at <= end)
    onCaret(index < 0 ? null : index)
  }

  async function take(next: File | undefined) {
    if (!next) return
    setProblem("")
    setReading(next.name)
    try {
      onChange(await readDocument(next))
      setFile(next.name)
      setCleared("")
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setReading("")
    }
  }

  function clear() {
    setCleared(value)
    setFile("")
    setProblem("")
    onChange("")
    field.current?.focus()
  }

  const pieces: React.ReactNode[] = []
  let at = 0
  spans.forEach(([start, end], index) => {
    pieces.push(value.slice(at, start))
    pieces.push(
      <Paragraph
        key={index}
        index={index}
        text={value.slice(start, end)}
        score={scores[index]}
        dimmed={active !== undefined && index !== active}
        register={register}
      />
    )
    at = end
  })
  // The zero-width space gives a trailing empty line a box, as the textarea has.
  pieces.push(value.slice(at), "​")

  const status = problem
    ? problem
    : reading
      ? `Reading ${reading}…`
      : cleared
        ? "Cleared."
        : [
            `${words.toLocaleString("en-US")} ${words === 1 ? "word" : "words"}`,
            spans.length > 1 && `${spans.length} paragraphs`,
            short > 0 && `${short} under ${minWords} words, too short to read`,
          ]
            .filter(Boolean)
            .join(" · ")

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        void take(event.dataTransfer.files[0])
      }}
      className={cn(
        "rounded-md transition-colors",
        over && "bg-marker/15 outline-2 outline-offset-8 outline-etch"
      )}
    >
      <div className="relative min-h-72 max-w-(--measure)">
        <div aria-hidden className={cn(TYPE, "min-h-72 text-ink")}>
          {pieces}
        </div>
        <Textarea
          ref={field}
          aria-label="Your text"
          value={value}
          spellCheck
          onChange={(event) => {
            setCleared("")
            onChange(event.target.value)
          }}
          onSelect={caret}
          onKeyUp={caret}
          onClick={caret}
          onBlur={() => onCaret(null)}
          placeholder="Write or paste here, or drop in a document. Each paragraph is read as you go."
          className={cn(
            TYPE,
            "absolute inset-0 h-full min-h-0 resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 text-transparent caret-ink shadow-none placeholder:text-graphite focus-visible:ring-0 md:text-[18px]/[1.7] dark:bg-transparent pointer-coarse:text-[18px]!"
          )}
        />
      </div>

      {/* Kept to the text's width: the column beside it belongs to the notes. */}
      <div className="mt-8 flex max-w-(--measure) flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-hairline pt-4">
        <p
          aria-live="polite"
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums",
            problem ? "text-destructive" : "text-graphite"
          )}
        >
          <span>{status}</span>
          {cleared && (
            <button
              type="button"
              onClick={() => {
                onChange(cleared)
                setCleared("")
              }}
              className="rounded-sm text-ink underline underline-offset-2"
            >
              Undo
            </button>
          )}
          {file && !cleared && (
            <span className="truncate text-ink/80">from {file}</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={DOCUMENT_TYPES}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void take(event.target.files?.[0])
              event.target.value = ""
            }}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              onClick={clear}
              // Pulled left by its own padding, so the label and not the invisible
              // pill lines up with the text above it.
              className="-ml-4 h-9 rounded-full px-4 text-graphite pointer-coarse:h-11"
            >
              Clear
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            className="h-9 rounded-full border-hairline bg-transparent px-4 pointer-coarse:h-11"
          >
            Open a document
          </Button>
        </div>
      </div>
    </div>
  )
}

function Paragraph({
  index,
  text,
  score,
  dimmed,
  register,
}: {
  index: number
  text: string
  score: Score | undefined
  dimmed: boolean
  register: (index: number, element: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const tells =
    score && isRead(score)
      ? score.rules.filter((rule) => rule.value > RULE_FIRED).flatMap(tellSpans)
      : []

  // A layout effect, because the bench measures its paragraphs in one of its own, and a
  // child's layout effects run before its parent's.
  useLayoutEffect(() => {
    register(index, ref.current)
    return () => register(index, null)
  }, [index, register])
  useEffect(() => dimMarkdownSyntax(ref.current), [text])
  useEffect(() => underlineTells(ref.current, tells), [tells])

  return (
    <span
      ref={ref}
      data-index={index}
      className={cn(
        "transition-colors duration-200",
        dimmed ? "text-graphite" : "text-ink"
      )}
    >
      {text}
    </span>
  )
}
