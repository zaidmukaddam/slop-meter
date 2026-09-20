import type { Span } from "@slop/features"

const TELL = "slop-tell"
const RULE = "slop-rule"
const SYNTAX = "slop-syntax"
const MARKDOWN_SYNTAX = /\*\*|__|^#{1,6}\s/gm

const STYLE = `
::highlight(${TELL}) {
  text-decoration: underline dotted var(--graphite);
  text-decoration-thickness: 1.5px;
}
::highlight(${RULE}) { background-color: var(--marker); color: var(--ink); }
::highlight(${SYNTAX}) { color: var(--etch); }
`

const supported = () => typeof CSS !== "undefined" && "highlights" in CSS
let shared: { tell: Highlight; syntax: Highlight } | null = null

function setup() {
  if (shared) return shared
  const style = document.createElement("style")
  style.textContent = STYLE
  document.head.append(style)
  shared = { tell: new Highlight(), syntax: new Highlight() }
  shared.syntax.priority = 0
  shared.tell.priority = 1
  CSS.highlights.set(SYNTAX, shared.syntax)
  CSS.highlights.set(TELL, shared.tell)
  return shared
}

function toRanges(element: Element | null, spans: Span[]): Range[] {
  const text = element?.firstChild
  if (!text || text.nodeType !== Node.TEXT_NODE) return []
  const length = text.textContent?.length ?? 0
  return spans
    .filter(([start, end]) => end <= length && start < end)
    .map(([start, end]) => {
      const range = new Range()
      range.setStart(text, start)
      range.setEnd(text, end)
      return range
    })
}

function addTo(highlight: Highlight, element: Element | null, spans: Span[]) {
  const ranges = toRanges(element, spans)
  for (const range of ranges) highlight.add(range)
  return () => {
    for (const range of ranges) highlight.delete(range)
  }
}

export function highlightSpans(element: Element | null, spans: Span[]) {
  if (!supported()) return
  setup()
  CSS.highlights.delete(RULE)
  const ranges = toRanges(element, spans)
  if (!ranges.length) return
  const highlight = new Highlight(...ranges)
  highlight.priority = 2
  CSS.highlights.set(RULE, highlight)
}

export function underlineTells(element: Element | null, spans: Span[]) {
  if (!supported() || !element) return () => {}
  return addTo(setup().tell, element, spans)
}

export function dimMarkdownSyntax(element: Element | null) {
  if (!supported() || !element) return () => {}
  const spans = [...(element.textContent ?? "").matchAll(MARKDOWN_SYNTAX)].map(
    (m): Span => [m.index, m.index + m[0].length]
  )
  return addTo(setup().syntax, element, spans)
}
