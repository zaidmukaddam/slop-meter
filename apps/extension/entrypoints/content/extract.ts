const SKIPPED_CONTAINERS = [
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "pre",
  "code",
  "[contenteditable]",
  '[aria-hidden="true"]',
  "button",
  "select",
  "textarea",
  "noscript",
  "template",
].join(",")

const CANDIDATES = "p,ul,ol,div,dd,blockquote"
const WRAPPER_TAGS = new Set(["div", "dd", "blockquote"])
const BLOCK_LEVEL =
  "p,div,ul,ol,dl,table,pre,blockquote,section,article,figure,h1,h2,h3,h4,h5,h6,li"
const IGNORED_INLINE = new Set(["script", "style", "noscript", "svg"])
const BOLD_TAGS = new Set(["strong", "b"])

const MAX_LINK_TEXT_SHARE = 0.5
const MIN_CONTENT_CHARS = 80
const BLANK_LINE_BREAKS = 2

export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0
}

export function findBlocks(
  minWords: number,
  isTracked: (el: HTMLElement) => boolean
): HTMLElement[] {
  const found: HTMLElement[] = []
  for (const root of contentRoots()) {
    for (const el of root.querySelectorAll<HTMLElement>(CANDIDATES)) {
      if (!isTracked(el) && isContentBlock(el, root, minWords)) found.push(el)
    }
  }
  return found
}

function isContentBlock(el: HTMLElement, root: Element, minWords: number) {
  if (el.parentElement?.closest("li,p")) return false
  if (WRAPPER_TAGS.has(el.localName) && el.querySelector(BLOCK_LEVEL)) {
    return false
  }
  const skipped = el.closest(SKIPPED_CONTAINERS)
  if (skipped && root.contains(skipped)) return false

  const text = el.textContent ?? ""
  if (countWords(text) < minWords) return false
  return linkTextLength(el) <= text.length * MAX_LINK_TEXT_SHARE
}

/**
 * Text written as one element with blank lines between paragraphs, the way
 * hand-written pages do it. The deepest such element wins, so a table wrapping
 * the prose doesn't claim it too.
 */
export function findRunContainers(
  minWords: number,
  isTracked: (el: HTMLElement) => boolean
): HTMLElement[] {
  const candidates: HTMLElement[] = []
  for (const root of contentRoots()) {
    const seen = new Set<HTMLElement>()
    for (const br of root.querySelectorAll("br")) {
      const el = br.parentElement
      if (!el || seen.has(el)) continue
      seen.add(el)
      if (!isTracked(el) && isRunContainer(el, root, minWords)) {
        candidates.push(el)
      }
    }
  }
  return candidates.filter(
    (el) => !candidates.some((other) => other !== el && el.contains(other))
  )
}

function isRunContainer(el: HTMLElement, root: Element, minWords: number) {
  const skipped = el.closest(SKIPPED_CONTAINERS)
  if (skipped && root.contains(skipped)) return false
  const text = el.textContent ?? ""
  if (linkTextLength(el) > text.length * MAX_LINK_TEXT_SHARE) return false
  return runsIn(el, minWords).length > 1
}

/** Runs long enough to score. Nested blocks are scored on their own, so they end a run. */
export function runsIn(el: HTMLElement, minWords: number): Node[][] {
  return splitRuns(el).filter(
    (nodes) =>
      countWords(nodes.map((node) => node.textContent ?? "").join(" ")) >=
      minWords
  )
}

function splitRuns(el: HTMLElement): Node[][] {
  const runs: Node[][] = []
  let run: Node[] = []
  let breaks = 0
  const end = () => {
    if (run.length) runs.push(run)
    run = []
  }
  for (const node of el.childNodes) {
    if (node instanceof HTMLBRElement) {
      if (++breaks >= BLANK_LINE_BREAKS) end()
      continue
    }
    if (node instanceof Text && !node.data.trim()) continue
    if (node instanceof Element && node.matches(BLOCK_LEVEL)) {
      end()
      breaks = 0
      continue
    }
    breaks = 0
    run.push(node)
  }
  end()
  return runs
}

export function serializeRun(nodes: Node[]): SerializedBlock {
  const builder = new TextBuilder()
  for (const node of nodes) builder.appendNode(node)
  builder.trimTrailingSpace()
  return { text: builder.text, positions: builder.positions }
}

export function runRect(nodes: Node[]): DOMRect | null {
  if (!nodes.length) return null
  const range = document.createRange()
  range.setStartBefore(nodes[0])
  range.setEndAfter(nodes[nodes.length - 1])
  const rect = range.getBoundingClientRect()
  return rect.height ? rect : null
}

function linkTextLength(el: Element): number {
  let length = 0
  for (const link of el.querySelectorAll("a")) {
    length += link.textContent?.length ?? 0
  }
  return length
}

function contentRoots(): Element[] {
  const main = document.querySelector('main,[role="main"]')
  if (main) return [main]

  const articles = [...document.querySelectorAll("article")].filter(
    (article) => !article.parentElement?.closest("article")
  )
  if (articles.length > 0) return articles

  return [commonContainer()]
}

function commonContainer(): Element {
  let root: Element | null = null
  for (const paragraph of document.body.querySelectorAll("p")) {
    if ((paragraph.textContent?.length ?? 0) < MIN_CONTENT_CHARS) continue
    if (paragraph.closest(SKIPPED_CONTAINERS)) continue
    root ??= paragraph.parentElement
    while (root && !root.contains(paragraph)) root = root.parentElement
  }
  return root ?? document.body
}

export type TextPosition = { node: Text; offset: number }

export type SerializedBlock = {
  text: string
  positions: (TextPosition | null)[]
}

export function serializeBlock(el: Element): SerializedBlock {
  const builder = new TextBuilder()
  if (el.localName === "ul" || el.localName === "ol") builder.appendList(el)
  else builder.appendChildren(el, false)
  builder.trimTrailingSpace()
  return { text: builder.text, positions: builder.positions }
}

class TextBuilder {
  text = ""
  positions: (TextPosition | null)[] = []
  private afterSpace = true

  appendList(list: Element) {
    for (const item of list.children) {
      if (item.localName !== "li") continue
      if (this.text) {
        this.trimTrailingSpace()
        this.appendMarkup("\n")
      }
      this.appendMarkup("- ")
      this.afterSpace = true
      this.appendChildren(item, false)
    }
  }

  appendChildren(parent: Node, insideBold: boolean) {
    for (const child of parent.childNodes) this.appendNode(child, insideBold)
  }

  appendNode(node: Node, insideBold = false) {
    if (node instanceof Text) this.appendText(node)
    else if (node instanceof Element) this.appendElement(node, insideBold)
  }

  trimTrailingSpace() {
    while (this.text.endsWith(" ")) this.truncate(this.text.length - 1)
  }

  private appendElement(el: Element, insideBold: boolean) {
    const tag = el.localName
    if (IGNORED_INLINE.has(tag) || tag === "slop-card") return
    if (tag === "br") {
      this.trimTrailingSpace()
      this.appendMarkup("\n")
      this.afterSpace = true
    } else if (BOLD_TAGS.has(tag) && !insideBold) {
      this.appendBold(el)
    } else {
      this.appendChildren(el, insideBold)
    }
  }

  private appendBold(el: Element) {
    const start = this.text.length
    this.appendMarkup("**")
    this.appendChildren(el, true)
    this.trimTrailingSpace()
    if (this.text.length === start + "**".length) {
      this.truncate(start)
      return
    }
    this.appendMarkup("**")
    this.afterSpace = false
  }

  private appendText(node: Text) {
    const data = node.data
    for (let offset = 0; offset < data.length; offset++) {
      const char = data[offset]
      if (!/\s/.test(char)) {
        this.appendChar(char, { node, offset })
        this.afterSpace = false
      } else if (!this.afterSpace) {
        this.appendChar(" ", { node, offset })
        this.afterSpace = true
      }
    }
  }

  private appendMarkup(markup: string) {
    this.text += markup
    for (let i = 0; i < markup.length; i++) this.positions.push(null)
  }

  private appendChar(char: string, position: TextPosition) {
    this.text += char
    this.positions.push(position)
  }

  private truncate(length: number) {
    this.text = this.text.slice(0, length)
    this.positions.length = length
  }
}
