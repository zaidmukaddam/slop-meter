import { readFile } from "node:fs/promises"
import { join } from "node:path"

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string }

const HEADING = /^#{2,6}\s+(.*)/
const TITLE = /^#\s/
const BULLET = /^\s*[-*]\s+(.*)/

export function parseChangelog(markdown: string): Block[] {
  const blocks: Block[] = []
  let list: string[] = []
  let paragraph: string[] = []

  const flush = () => {
    if (list.length) blocks.push({ kind: "list", items: list })
    if (paragraph.length)
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") })
    list = []
    paragraph = []
  }

  for (const line of markdown.split("\n")) {
    const heading = line.match(HEADING)
    const bullet = line.match(BULLET)
    if (TITLE.test(line)) {
      flush()
    } else if (heading) {
      flush()
      blocks.push({ kind: "heading", text: heading[1] })
    } else if (bullet) {
      if (paragraph.length) flush()
      list.push(bullet[1])
    } else if (!line.trim()) {
      flush()
    } else if (list.length) {
      list[list.length - 1] += ` ${line.trim()}`
    } else {
      paragraph.push(line.trim())
    }
  }
  flush()
  return blocks
}

export async function readChangelog(): Promise<Block[] | null> {
  const path = join(process.cwd(), "../../CHANGELOG.md")
  const markdown = await readFile(path, "utf8").catch(() => null)
  return markdown ? parseChangelog(markdown) : null
}
