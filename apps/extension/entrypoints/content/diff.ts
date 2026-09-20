import { escapeHtml } from "./html"

const MAX_DIFF_CELLS = 4_000_000

type Change = { kind: "same" | "removed" | "added"; words: string[] }

export function wordDiffHtml(before: string, after: string): string {
  const oldWords = tokenize(before)
  const newWords = tokenize(after)
  if (oldWords.length * newWords.length > MAX_DIFF_CELLS) {
    return escapeHtml(after)
  }
  return diffWords(oldWords, newWords)
    .map(renderChange)
    .join(" ")
    .replace(/ ?\n ?/g, "\n")
}

function tokenize(text: string): string[] {
  return text.match(/\n|\S+/g) ?? []
}

function renderChange(change: Change): string {
  const text = escapeHtml(change.words.join(" "))
  if (change.kind === "removed") return `<del>${text}</del>`
  if (change.kind === "added") return `<ins>${text}</ins>`
  return text
}

function diffWords(a: string[], b: string[]): Change[] {
  const lcs = lcsTable(a, b)
  const width = b.length + 1
  const changes: Change[] = []
  const push = (kind: Change["kind"], word: string) => {
    changes.push({ kind, words: [word] })
  }

  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push("same", a[i])
      i++
      j++
      continue
    }
    const addingKeepsMore =
      i === a.length || lcs[i * width + j + 1] >= lcs[(i + 1) * width + j]
    if (j < b.length && addingKeepsMore) {
      push("added", b[j])
      j++
    } else {
      push("removed", a[i])
      i++
    }
  }
  return groupRemovalsFirst(changes)
}

function groupRemovalsFirst(changes: Change[]): Change[] {
  const grouped: Change[] = []
  let removed: string[] = []
  let added: string[] = []
  const flush = () => {
    if (removed.length > 0) grouped.push({ kind: "removed", words: removed })
    if (added.length > 0) grouped.push({ kind: "added", words: added })
    removed = []
    added = []
  }
  for (const change of changes) {
    if (change.kind === "removed") removed.push(...change.words)
    else if (change.kind === "added") added.push(...change.words)
    else {
      flush()
      grouped.push(change)
    }
  }
  flush()
  return grouped
}

function lcsTable(a: string[], b: string[]): Uint16Array {
  const width = b.length + 1
  const table = new Uint16Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }
  return table
}
