import type { Score, Scorer } from "@slop/model"
import {
  findBlocks,
  findRunContainers,
  runRect,
  runsIn,
  serializeBlock,
  serializeRun,
} from "./extract"

export type Block = {
  el: HTMLElement
  /** Set when the block is one run of a text separated only by blank lines. */
  nodes?: Node[]
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
  private blocks = new Map<HTMLElement, Block[]>()
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

  get(el: Element, y?: number): Block | undefined {
    const blocks = this.blocks.get(el as HTMLElement)
    if (!blocks || y === undefined || blocks.length < 2) return blocks?.[0]
    return blocks.find((block) => {
      const rect = block.nodes && runRect(block.nodes)
      return rect && y >= rect.top && y <= rect.bottom
    })
  }

  *all(): IterableIterator<Block> {
    for (const blocks of this.blocks.values()) yield* blocks
  }

  private discover(): void {
    if (!this.scorer) return
    for (const el of this.blocks.keys()) {
      if (el.isConnected) continue
      this.blocks.delete(el)
      this.intersections.unobserve(el)
    }
    const tracked = (el: HTMLElement) => this.blocks.has(el)
    for (const el of findBlocks(this.minWords, tracked)) {
      this.blocks.set(el, [{ el, dirty: false }])
      this.intersections.observe(el)
    }
    for (const el of findRunContainers(this.minWords, tracked)) {
      const runs = runsIn(el, this.minWords).map((nodes) => ({
        el,
        nodes,
        dirty: false,
      }))
      this.blocks.set(el, runs)
      this.intersections.observe(el)
    }
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      for (const block of this.blocks.get(entry.target as HTMLElement) ?? []) {
        if (!block.score || block.dirty) this.queue.add(block)
      }
    }
    this.scheduleFlush()
  }

  private onMutate(records: MutationRecord[]): void {
    for (const record of records) {
      for (const block of this.enclosingBlocks(record.target)) {
        if (block.score && !block.dirty) this.markDirty(block)
      }
    }
    clearTimeout(this.discoverTimer)
    this.discoverTimer = window.setTimeout(() => {
      requestIdleCallback(() => this.discover(), {
        timeout: DISCOVER_IDLE_TIMEOUT_MS,
      })
    }, MUTATION_DEBOUNCE_MS)
  }

  private enclosingBlocks(node: Node): Block[] {
    for (
      let n: Node | null = node;
      n && n !== document.body;
      n = n.parentNode
    ) {
      const blocks = this.blocks.get(n as HTMLElement)
      if (blocks) return blocks
    }
    return []
  }

  private markDirty(block: Block): void {
    block.dirty = true
    this.intersections.unobserve(block.el)
    this.intersections.observe(block.el)
  }

  private scheduleFlush(): void {
    if (this.flushing || this.queue.size === 0 || !this.scorer) return
    this.flushing = true
    requestIdleCallback((deadline) => this.flush(deadline), {
      timeout: FLUSH_IDLE_TIMEOUT_MS,
    })
  }

  rescoreAll(): void {
    for (const block of this.all()) {
      if (block.score) this.markDirty(block)
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
      })
      for (const block of batch) {
        const pending = this.blocks
          .get(block.el)
          ?.some((b) => !b.score || b.dirty)
        if (!pending) this.intersections.unobserve(block.el)
      }
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
      block.text = block.nodes
        ? serializeRun(block.nodes).text
        : serializeBlock(block.el).text
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
