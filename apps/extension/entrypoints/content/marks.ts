import { DECISION_LABEL, type Score, isRead, shownP } from "@slop/model"
import { ANSWER_HEX, MARKER_HEX } from "@slop/theme/palette"
import { firstLineRect } from "./extract"
import { HIGHLIGHT_NAME } from "./highlight"
import type { Block } from "./scheduler"

export const MARKED_SELECTOR = "[data-slop]"

const MIN_OPACITY = 0.3
const LAMP_PX = 7
const LAMP_GAP_PX = 7
export const LAMP_REACH_PX = LAMP_PX + LAMP_GAP_PX

export function createPageStyle(): HTMLStyleElement {
  const style = document.createElement("style")
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) {
  background-color: rgb(from ${MARKER_HEX} r g b / 0.6);
}`
  return style
}

export class Lamps {
  private layer = document.createElement("slop-marks")
  private lamps = new Map<Block, HTMLElement>()

  constructor(private onPick: (block: Block) => void) {}

  lampFor(block: Block): HTMLElement | undefined {
    return this.lamps.get(block)
  }

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
    if (!line || !score || !isRead(score)) return this.erase(block)

    let lamp = this.lamps.get(block)
    if (!lamp) {
      lamp = document.createElement("slop-mark")
      lamp.style.cssText = `position:absolute;width:${LAMP_PX}px;height:${LAMP_PX}px;border-radius:50%`
      if (block.nodes) {
        lamp.style.pointerEvents = "auto"
        lamp.tabIndex = 0
        lamp.setAttribute("role", "button")
        lamp.addEventListener("focus", () => this.onPick(block))
        lamp.addEventListener("click", () => this.onPick(block))
        block.focusEl = lamp
      }
      this.lamps.set(block, lamp)
      this.layer.append(lamp)
    }
    if (block.nodes) {
      lamp.setAttribute(
        "aria-label",
        `${DECISION_LABEL[score.localDecision]}, ${Math.round(shownP(score.localP) * 100)} percent. Paragraph reading.`
      )
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
    block.focusEl = undefined
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
