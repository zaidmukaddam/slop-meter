import type { Score, Scorer } from "@slop/model"
import { findBlocks, serializeBlock } from "./extract"

export type Block = {
  el: HTMLElement
  text?: string
  score?: Score
  dirty: boolean
}

const OBSERVER_ROOT_MARGIN = "100% 0px"
const MUTATION_DEBOUNCE_MS = 400
const DISCOVER_IDLE_TIMEOUT_MS = 1000
const FLUSH_IDLE_TIMEOUT_MS = 300
const MAX_BATCH = 32
const MIN_BUDGET_MS = 6
const INITIAL_MS_PER_BLOCK = 1
const COST_SMOOTHING = 0.3

export class BlockScheduler {
  private blocks = new Map<HTMLElement, Block>()
  private queue = new Set<Block>()
  private scorer: Scorer | null = null
  private flushing = false
  private msPerBlock = INITIAL_MS_PER_BLOCK
  private discoverTimer = 0
  private intersections = new IntersectionObserver(
    (entries) => this.onIntersect(entries),
    { rootMargin: OBSERVER_ROOT_MARGIN }
  )
  private mutations = new MutationObserver((records) => this.onMutate(records))

  constructor(
    private minWords: number,
    private onScored: (batch: Block[]) => void
  ) {}

  start(scorer: Scorer): void {
    this.scorer = scorer
    this.mutations.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    this.discover()
  }

  stop(): void {
    this.scorer = null
    this.mutations.disconnect()
    this.intersections.disconnect()
    clearTimeout(this.discoverTimer)
    this.queue.clear()
    this.blocks.clear()
  }

  get(el: Element): Block | undefined {
    return this.blocks.get(el as HTMLElement)
  }

  all(): IterableIterator<Block> {
    return this.blocks.values()
  }

  private discover(): void {
    if (!this.scorer) return
    for (const el of this.blocks.keys()) {
      if (el.isConnected) continue
      this.blocks.delete(el)
      this.intersections.unobserve(el)
    }
    for (const el of findBlocks(this.minWords, (el) => this.blocks.has(el))) {
      this.blocks.set(el, { el, dirty: false })
      this.intersections.observe(el)
    }
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const block = this.get(entry.target)
      const needsScore = block && (!block.score || block.dirty)
      if (entry.isIntersecting && needsScore) this.queue.add(block)
    }
    this.scheduleFlush()
  }

  private onMutate(records: MutationRecord[]): void {
    for (const record of records) {
      const block = this.enclosingBlock(record.target)
      if (block?.score && !block.dirty) {
        block.dirty = true
        this.intersections.unobserve(block.el)
        this.intersections.observe(block.el)
      }
    }
    clearTimeout(this.discoverTimer)
    this.discoverTimer = window.setTimeout(() => {
      requestIdleCallback(() => this.discover(), {
        timeout: DISCOVER_IDLE_TIMEOUT_MS,
      })
    }, MUTATION_DEBOUNCE_MS)
  }

  private enclosingBlock(node: Node): Block | undefined {
    for (
      let n: Node | null = node;
      n && n !== document.body;
      n = n.parentNode
    ) {
      const block = this.blocks.get(n as HTMLElement)
      if (block) return block
    }
    return undefined
  }

  private scheduleFlush(): void {
    if (this.flushing || this.queue.size === 0 || !this.scorer) return
    this.flushing = true
    requestIdleCallback((deadline) => this.flush(deadline), {
      timeout: FLUSH_IDLE_TIMEOUT_MS,
    })
  }

  rescoreAll(): void {
    for (const block of this.blocks.values()) {
      if (!block.score) continue
      block.dirty = true
      this.intersections.unobserve(block.el)
      this.intersections.observe(block.el)
    }
  }

  private async flush(deadline: IdleDeadline): Promise<void> {
    try {
      const scorer = this.scorer
      if (!scorer) return
      const started = performance.now()
      const batch = this.takeBatch(deadline)
      const scoring = scorer.scoreBatch(batch.map((block) => block.text ?? ""))
      this.recordCost(performance.now() - started, batch.length)
      const scores = await scoring

      batch.forEach((block, i) => {
        block.score = scores[i]
        this.intersections.unobserve(block.el)
      })
      if (this.scorer) this.onScored(batch)
    } catch {
    } finally {
      this.flushing = false
      this.scheduleFlush()
    }
  }

  private takeBatch(deadline: IdleDeadline): Block[] {
    const budget = Math.max(deadline.timeRemaining(), MIN_BUDGET_MS)
    const size = Math.min(MAX_BATCH, Math.floor(budget / this.msPerBlock))
    const batch: Block[] = []
    for (const block of this.queue) {
      if (batch.length >= Math.max(1, size)) break
      this.queue.delete(block)
      const visible = block.el.checkVisibility({ visibilityProperty: true })
      if (!block.el.isConnected || !visible) continue
      block.text = serializeBlock(block.el).text
      block.dirty = false
      batch.push(block)
    }
    return batch
  }

  private recordCost(elapsedMs: number, blocks: number): void {
    const perBlock = elapsedMs / Math.max(blocks, 1)
    this.msPerBlock =
      (1 - COST_SMOOTHING) * this.msPerBlock + COST_SMOOTHING * perBlock
  }
}
