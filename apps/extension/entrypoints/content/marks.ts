import type { Score } from "@slop/model"
import { ANSWER_HEX, MARKER_HEX } from "@slop/theme/palette"
import { HIGHLIGHT_NAME } from "./highlight"

export const MARKED_SELECTOR = "[data-slop]"

const CONFIDENCE_LEVELS = 10
const MIN_OPACITY = 0.25
const BAR_WIDTH_PX = 3
const BAR_INSET_PX = 1

export function createPageStyle(): HTMLStyleElement {
  const style = document.createElement("style")
  style.textContent = pageCss()
  return style
}

export function markBlock(el: HTMLElement, score: Score): void {
  const p = Math.min(1, Math.max(0, score.localP))
  el.dataset.slop = score.localDecision
  el.dataset.slopConfidence = String(Math.round(p * (CONFIDENCE_LEVELS - 1)))
  if (!el.hasAttribute("tabindex")) {
    el.tabIndex = 0
    el.dataset.slopFocusable = ""
  }
}

export function unmarkBlock(el: HTMLElement): void {
  delete el.dataset.slop
  delete el.dataset.slopConfidence
  if ("slopFocusable" in el.dataset) {
    el.removeAttribute("tabindex")
    delete el.dataset.slopFocusable
  }
}

function pageCss(): string {
  const offset = BAR_WIDTH_PX + BAR_INSET_PX
  const colors = Object.entries(ANSWER_HEX)
    .map(
      ([decision, hex]) => `[data-slop="${decision}"] { --slop-color: ${hex}; }`
    )
    .join("\n")
  const opacities = Array.from({ length: CONFIDENCE_LEVELS }, (_, level) => {
    const share = level / (CONFIDENCE_LEVELS - 1)
    const opacity = MIN_OPACITY + (1 - MIN_OPACITY) * share
    return `[data-slop-confidence="${level}"] { --slop-opacity: ${opacity.toFixed(2)}; }`
  }).join("\n")

  return `
[data-slop] {
  box-shadow: -${offset}px 0 0 -${BAR_INSET_PX}px
    rgb(from var(--slop-color) r g b / var(--slop-opacity)) !important;
}
${colors}
${opacities}
::highlight(${HIGHLIGHT_NAME}) {
  background-color: rgb(from ${MARKER_HEX} r g b / 0.6);
}
`
}
