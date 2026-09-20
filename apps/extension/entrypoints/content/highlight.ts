import type { Reason } from "@slop/model"
import { tellSpans } from "@slop/rules/names"
import { type TextPosition, serializeBlock } from "./extract"

export const HIGHLIGHT_NAME = "slop"

export function highlightReasons(
  el: Element,
  scoredText: string,
  reasons: Reason[]
): void {
  if (!CSS.highlights) return
  const { text, positions } = serializeBlock(el)
  if (text !== scoredText) return

  const ranges: Range[] = []
  for (const [start, end] of reasons.flatMap(tellSpans)) {
    const range = rangeForSpan(positions, start, end)
    if (range) ranges.push(range)
  }
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges))
}

export function clearHighlights(): void {
  CSS.highlights?.delete(HIGHLIGHT_NAME)
}

function rangeForSpan(
  positions: (TextPosition | null)[],
  start: number,
  end: number
): Range | null {
  const inside = positions.slice(start, end)
  const first = inside.find((position) => position !== null)
  const last = inside.findLast((position) => position !== null)
  if (!first || !last) return null

  const range = document.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
}
