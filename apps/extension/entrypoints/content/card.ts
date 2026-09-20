import {
  type ModelClass,
  type Reason,
  type Score,
  type SiteClass,
  explain,
} from "@slop/model"
import { type StoredCorrection, send } from "../../shared/messages"
import { manifest } from "../../shared/model"
import type { Settings } from "../../shared/settings"
import CARD_CSS from "./card.css?inline"
import {
  REWRITE_OFF_HTML,
  REWRITE_PENDING_HTML,
  cardHtml,
  isLabel,
  labelPickerHtml,
  rewriteFooterHtml,
  savedNoteHtml,
  selectionHtml,
  tooShortHtml,
} from "./card-view"
import { wordDiffHtml } from "./diff"
import { firstLineRect } from "./extract"
import { clearHighlights, highlightReasons } from "./highlight"
import { streamRewrite } from "./rewrite"
import type { Block } from "./scheduler"

const TOP_REASONS = 3
const CARD_WIDTH_PX = 320
const CARD_GAP_PX = 10
const VIEWPORT_MARGIN_PX = 8
const BESIDE_OFFSET_Y_PX = -16
const POINTER_OFFSET_X_PX = -6
const POINTER_OFFSET_Y_PX = 10
const MAX_Z_INDEX = "2147483647"

export type CardAnchor = { x: number; y: number } | null

type Subject = {
  rect: () => DOMRect
  el: Element
  reading?: { text: string; score: Score; block?: Block }
}

export class Card {
  readonly host = document.createElement("slop-card")
  pinned = false
  refocusing = false
  private body: HTMLDivElement
  private subject: Subject | null = null
  private anchor: CardAnchor = null
  private reasons: Reason[] = []
  private rewrittenText = ""
  private cancelRewrite: (() => void) | null = null

  constructor(
    private siteClass: SiteClass,
    private settings: () => Settings
  ) {
    Object.assign(this.host.style, {
      all: "initial",
      position: "fixed",
      zIndex: MAX_Z_INDEX,
      display: "none",
    })
    const shadow = this.host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<style>${CARD_CSS}</style>`
    this.body = document.createElement("div")
    this.body.className = "card"
    this.body.style.width = `${CARD_WIDTH_PX}px`
    this.body.setAttribute("role", "dialog")
    this.body.setAttribute("aria-label", "Slop Meter")
    this.body.lang = "en"
    shadow.append(this.body)
    this.body.addEventListener("click", (event) => this.onClick(event))
  }

  get isOpen(): boolean {
    return this.subject !== null
  }

  get block(): Block | null {
    return this.subject?.reading?.block ?? null
  }

  get openedByKeyboard(): boolean {
    return this.block !== null && this.anchor === null
  }

  mount(): void {
    document.documentElement.append(this.host)
  }

  unmount(): void {
    this.close()
    this.host.remove()
  }

  open(block: Block, anchor: CardAnchor): void {
    const { score, text } = block
    if (!score || !text || !block.el.isConnected) return
    const rect = () =>
      firstLineRect(block.nodes ?? block.el) ?? block.el.getBoundingClientRect()
    this.show(
      { rect, el: block.el, reading: { text, score, block } },
      anchor,
      false
    )
    highlightReasons(block.el, text, this.reasons, block.nodes)
  }

  openSelection(range: Range, paragraphs: string[], scores: Score[]): void {
    const container = range.commonAncestorContainer
    const el =
      container instanceof Element ? container : container.parentElement
    if (!el) return
    const single = scores.length === 1 && !scores[0].tooShort
    this.show(
      {
        rect: () => range.getBoundingClientRect(),
        el,
        reading: single ? { text: paragraphs[0], score: scores[0] } : undefined,
      },
      null,
      true,
      single
        ? undefined
        : scores.every((s) => s.tooShort)
          ? tooShortHtml(manifest.minWords)
          : selectionHtml(paragraphs, scores)
    )
  }

  close(): void {
    this.cancelRewrite?.()
    this.cancelRewrite = null
    this.subject = null
    this.pinned = false
    this.host.style.display = "none"
    clearHighlights()
  }

  closeAndRefocus(): void {
    const block = this.block
    const hadFocus = document.activeElement === this.host
    this.close()
    if (!block || !hadFocus) return
    this.refocusing = true
    block.el.focus({ preventScroll: true })
    this.refocusing = false
  }

  focusFirstAction(): void {
    this.body.querySelector<HTMLElement>(".row button")?.focus()
  }

  reposition(): void {
    if (!this.subject) return
    const target = this.subject.rect()
    const width = CARD_WIDTH_PX
    const height = this.body.offsetHeight
    const m = VIEWPORT_MARGIN_PX
    const pointer = this.anchor ?? { x: target.left, y: target.top }
    // Beside the mark it belongs to: under the line first, then over it.
    const beside = clamp(target.left - CARD_GAP_PX - width, m, innerWidth)
    const y = clamp(pointer.y + BESIDE_OFFSET_Y_PX, m, innerHeight - height - m)
    const x = clamp(target.left - CARD_GAP_PX, m, innerWidth - width - m)
    const spots = [
      { left: x, top: target.bottom + CARD_GAP_PX },
      { left: x, top: target.top - CARD_GAP_PX - height },
      { left: beside, top: y },
      { left: target.right + CARD_GAP_PX, top: y },
    ]
    const fits = ({ left, top }: { left: number; top: number }) =>
      left >= m &&
      top >= m &&
      left + width <= innerWidth - m &&
      top + height <= innerHeight - m
    const spot = spots.find(fits) ?? {
      left: clamp(pointer.x + POINTER_OFFSET_X_PX, m, innerWidth - width - m),
      top: clamp(pointer.y + POINTER_OFFSET_Y_PX, m, innerHeight - height - m),
    }
    this.host.style.left = `${spot.left}px`
    this.host.style.top = `${spot.top}px`
  }

  private show(
    subject: Subject,
    anchor: CardAnchor,
    pinned: boolean,
    html?: string
  ): void {
    this.cancelRewrite?.()
    this.subject = subject
    this.anchor = anchor
    this.pinned = pinned
    const reading = subject.reading
    this.reasons = reading ? explain(reading.score, TOP_REASONS) : []
    this.body.innerHTML = html ?? cardHtml(reading!.score, this.reasons)
    this.host.style.colorScheme = pageIsDark(subject.el) ? "dark" : "light"
    this.host.style.display = "block"
    this.reposition()
  }

  private onClick(event: MouseEvent): void {
    const button = (event.target as Element).closest("button")
    if (!button || !this.subject) return
    this.pinned = true
    switch (button.dataset.action) {
      case "close":
        this.closeAndRefocus()
        break
      case "wrong":
        this.showLabelPicker()
        break
      case "label":
        if (isLabel(button.dataset.label)) this.saveLabel(button.dataset.label)
        break
      case "rewrite":
        this.startRewrite()
        break
      case "copy":
        this.copyRewrite(button)
        break
    }
  }

  private showPanel(html: string): HTMLElement {
    const panel = this.body.querySelector<HTMLElement>(".panel")!
    panel.innerHTML = html
    return panel
  }

  private showLabelPicker(): void {
    const score = this.subject?.reading?.score
    if (score) this.showPanel(labelPickerHtml(score.localDecision))
  }

  private async saveLabel(label: ModelClass): Promise<void> {
    const score = this.subject?.reading?.score
    if (!score) return
    const { spec, version } = score.model.manifest
    const item: StoredCorrection = {
      vector: Array.from(score.vector),
      predicted: score.localDecision,
      label,
      p: score.localP,
      siteClass: this.siteClass,
      spec,
      modelVersion: version,
      ts: Date.now(),
    }
    const saved = await send({ type: "correct", item })
    this.showPanel(savedNoteHtml(saved === true, this.settings().share))
  }

  private startRewrite(): void {
    const original = this.subject?.reading?.text
    if (!original) return
    if (!this.settings().rewrite) {
      this.showPanel(REWRITE_OFF_HTML)
      return
    }
    this.cancelRewrite?.()
    const panel = this.showPanel(REWRITE_PENDING_HTML)
    const output = panel.querySelector<HTMLElement>(".rewrite")!
    const ruleIds = this.reasons.map((reason) => reason.id)
    this.cancelRewrite = streamRewrite(
      { text: original, ruleIds },
      {
        progress: (textSoFar) => {
          output.textContent = textSoFar
        },
        error: (message) => {
          output.textContent = message
        },
        done: (result) => {
          this.rewrittenText = result.text
          output.innerHTML = wordDiffHtml(original, result.text)
          panel.insertAdjacentHTML(
            "beforeend",
            rewriteFooterHtml(result.removedRuleIds)
          )
          this.reposition()
        },
      }
    )
  }

  private async copyRewrite(button: HTMLButtonElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.rewrittenText)
    } catch {
      this.copyViaSelection(this.rewrittenText)
    }
    button.textContent = "Copied"
  }

  private copyViaSelection(text: string): void {
    const field = document.createElement("textarea")
    field.value = text
    this.body.append(field)
    field.select()
    document.execCommand("copy")
    field.remove()
  }
}

function pageIsDark(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const rgba = getComputedStyle(node).backgroundColor.match(
      /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/
    )
    if (!rgba || Number(rgba[4] ?? 1) < 0.5) continue
    const [r, g, b] = rgba.slice(1, 4).map(Number)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
  }
  return getComputedStyle(document.documentElement).colorScheme === "dark"
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}
