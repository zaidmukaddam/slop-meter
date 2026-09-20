import type { Score } from "@slop/model"
import { ANSWER_HEX, MARKER_HEX } from "@slop/theme/palette"
import { firstLineRect } from "./extract"
import { HIGHLIGHT_NAME } from "./highlight"
import type { Block } from "./scheduler"

export const MARKED_SELECTOR = "[data-slop]"

const MIN_OPACITY = 0.3
const LAMP_PX = 7
const LAMP_GAP_PX = 7
/** How far left of the text a lamp reaches, so the card's hit zone can cover it. */
export const LAMP_REACH_PX = LAMP_PX + LAMP_GAP_PX

export function createPageStyle(): HTMLStyleElement {
  const style = document.createElement("style")
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) {
  background-color: rgb(from ${MARKER_HEX} r g b / 0.6);
}`
  return style
}

/**
 * One lamp in the margin beside each paragraph's first line, drawn in an
 * overlay in page coordinates. Nothing in the page's own styles is touched.
 */
export class Lamps {
  private layer = document.createElement("slop-marks")
  private lamps = new Map<Block, HTMLElement>()

  mount(): void {
    this.layer.style.cssText =
      "position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646"
    document.body.append(this.layer)
  }

  unmount(): void {
    this.lamps.clear()
    this.layer.remove()
    this.layer.replaceChildren()
  }

  draw(block: Block): void {
    const line = firstLineRect(block.nodes ?? block.el)
    const score = block.score
    if (!line || !score || score.tooShort) return this.erase(block)

    let lamp = this.lamps.get(block)
    if (!lamp) {
      lamp = document.createElement("slop-mark")
      lamp.style.cssText = `position:absolute;width:${LAMP_PX}px;height:${LAMP_PX}px;border-radius:50%`
      this.lamps.set(block, lamp)
      this.layer.append(lamp)
    }
    const p = Math.min(1, Math.max(0, score.localP))
    lamp.style.left = `${line.left + scrollX - LAMP_GAP_PX - LAMP_PX}px`
    lamp.style.top = `${line.top + scrollY + (line.height - LAMP_PX) / 2}px`
    lamp.style.background = ANSWER_HEX[score.localDecision]
    lamp.style.opacity = String(MIN_OPACITY + (1 - MIN_OPACITY) * p)
  }

  erase(block: Block): void {
    this.lamps.get(block)?.remove()
    this.lamps.delete(block)
  }
}

export function markBlock(el: HTMLElement, score: Score): void {
  el.dataset.slop = score.localDecision
  if (!el.hasAttribute("tabindex")) {
    el.tabIndex = 0
    el.dataset.slopFocusable = ""
  }
}

export function unmarkBlock(el: HTMLElement): void {
  delete el.dataset.slop
  if ("slopFocusable" in el.dataset) {
    el.removeAttribute("tabindex")
    delete el.dataset.slopFocusable
  }
}
