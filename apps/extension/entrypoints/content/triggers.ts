import type { Card } from "./card"
import { runRect } from "./extract"
import { LAMP_REACH_PX, MARKED_SELECTOR } from "./marks"
import type { Block } from "./scheduler"

const HOVER_DELAY_MS = 120
const HIDE_DELAY_MS = 300
const GUTTER_HIT_OUTSIDE_PX = LAMP_REACH_PX + 8
const GUTTER_HIT_INSIDE_PX = 3
const PROBE_OFFSET_PX = LAMP_REACH_PX + 6

export class CardTriggers {
  private hoverTimer = 0
  private hideTimer = 0
  private pendingBlock: Block | null = null
  private frame = 0
  private lastPointer: PointerEvent | null = null
  private overCard = false

  constructor(
    private card: Card,
    private blockAt: (el: Element, y?: number) => Block | undefined
  ) {
    card.host.addEventListener("pointerenter", () => {
      this.overCard = true
      this.cancelHide()
    })
    card.host.addEventListener("pointerleave", () => {
      this.overCard = false
      if (!card.pinned) this.scheduleHide()
    })
  }

  attach(): void {
    addEventListener("pointermove", this.onPointerMove, { passive: true })
    addEventListener("scroll", this.onScroll, { passive: true, capture: true })
    addEventListener("pointerdown", this.onPointerDown, true)
    addEventListener("keydown", this.onKeyDown)
    addEventListener("focusin", this.onFocusIn)
    addEventListener("focusout", this.onFocusOut)
  }

  detach(): void {
    removeEventListener("pointermove", this.onPointerMove)
    removeEventListener("scroll", this.onScroll, true)
    removeEventListener("pointerdown", this.onPointerDown, true)
    removeEventListener("keydown", this.onKeyDown)
    removeEventListener("focusin", this.onFocusIn)
    removeEventListener("focusout", this.onFocusOut)
    clearTimeout(this.hoverTimer)
    this.cancelHide()
  }

  private onPointerMove = (event: PointerEvent) => {
    this.lastPointer = event
    if (!this.frame) this.frame = requestAnimationFrame(this.probe)
  }

  private probe = () => {
    this.frame = 0
    const pointer = this.lastPointer
    if (!pointer || this.card.pinned || this.card.openedByKeyboard) return
    if (this.overCard && this.card.block) return

    const { clientX: x, clientY: y } = pointer
    const block = this.blockInGutter(x, y)
    if (block) {
      this.cancelHide()
      if (block !== this.card.block && block !== this.pendingBlock) {
        this.pendingBlock = block
        clearTimeout(this.hoverTimer)
        this.hoverTimer = window.setTimeout(() => {
          this.pendingBlock = null
          this.card.open(block, { x, y })
        }, HOVER_DELAY_MS)
      }
      return
    }
    clearTimeout(this.hoverTimer)
    this.pendingBlock = null
    if (this.card.block && !this.hideTimer) this.scheduleHide()
  }

  private blockInGutter(x: number, y: number): Block | null {
    const hit = document.elementFromPoint(x + PROBE_OFFSET_PX, y)
    if (!hit) return null
    const el = hit.closest(MARKED_SELECTOR) ?? hit
    const block = this.blockAt(el, y)
    if (!block?.score) return null
    const edge = (
      block.nodes ? runRect(block.nodes) : block.el.getBoundingClientRect()
    )?.left
    if (edge === undefined) return null
    const inZone =
      x >= edge - GUTTER_HIT_OUTSIDE_PX && x <= edge + GUTTER_HIT_INSIDE_PX
    return inZone ? block : null
  }

  private onScroll = () => {
    if (!this.card.isOpen) return
    if (this.card.pinned || this.card.openedByKeyboard) this.card.reposition()
    else this.card.close()
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.card.pinned && event.target !== this.card.host) this.card.close()
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.card.isOpen) return
    if (event.key === "Escape") {
      this.card.closeAndRefocus()
    } else if (event.key === "Enter" && event.target === this.card.block?.el) {
      event.preventDefault()
      this.card.focusFirstAction()
    }
  }

  private onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (this.card.refocusing || !(target instanceof HTMLElement)) return
    if (!target.matches(MARKED_SELECTOR) || !target.matches(":focus-visible")) {
      return
    }
    const block = this.blockAt(target)
    if (block?.score) this.card.open(block, null)
  }

  private onFocusOut = (event: FocusEvent) => {
    const block = this.card.block
    if (!block || this.card.pinned || !this.card.openedByKeyboard) return
    const staysWithCard = (node: EventTarget | null) =>
      node === (block.focusEl ?? block.el) || node === this.card.host
    if (staysWithCard(event.target) && !staysWithCard(event.relatedTarget)) {
      this.card.close()
    }
  }

  private scheduleHide(): void {
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0
      this.card.close()
    }, HIDE_DELAY_MS)
  }

  private cancelHide(): void {
    clearTimeout(this.hideTimer)
    this.hideTimer = 0
  }
}
