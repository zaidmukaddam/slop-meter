export type Span = [start: number, end: number]
export type Word = { lower: string; start: number; end: number }
export type Sentence = { start: number; end: number; words: Word[] }
export type Parsed = {
  raw: string
  text: string
  words: Word[]
  sentences: Sentence[]
  lines: Span[]
}

const WORD = /[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)*|\d+(?:[.,]\d+)*/g
const SENTENCE_END = /[.!?…]+["'”’)\]]*(?=\s|$)|\n+(?![ \t]*[a-z])/g
const CURLY_APOSTROPHE = /’/g

export function parse(raw: string): Parsed {
  const text = raw.replace(CURLY_APOSTROPHE, "'")
  const words = tokenize(text)
  return {
    raw,
    text,
    words,
    sentences: splitSentences(text, words),
    lines: nonBlankLines(text),
  }
}

function tokenize(text: string): Word[] {
  return [...text.matchAll(WORD)].map((m) => ({
    lower: m[0].toLowerCase(),
    start: m.index,
    end: m.index + m[0].length,
  }))
}

function splitSentences(text: string, words: Word[]): Sentence[] {
  const sentences: Sentence[] = []
  let from = 0
  let nextWord = 0

  const close = (end: number) => {
    const chunk = text.slice(from, end)
    const start = from + (chunk.length - chunk.trimStart().length)
    if (end <= start) return
    const inside: Word[] = []
    while (nextWord < words.length && words[nextWord].start < end) {
      if (words[nextWord].start >= start) inside.push(words[nextWord])
      nextWord++
    }
    if (inside.length) sentences.push({ start, end, words: inside })
  }

  for (const m of text.matchAll(SENTENCE_END)) {
    const isLineBreak = m[0].startsWith("\n")
    close(isLineBreak ? m.index : m.index + m[0].length)
    from = m.index + m[0].length
  }
  close(text.trimEnd().length)
  return sentences
}

function nonBlankLines(text: string): Span[] {
  const lines: Span[] = []
  let offset = 0
  for (const line of text.split("\n")) {
    if (line.trim()) lines.push([offset, offset + line.length])
    offset += line.length + 1
  }
  return lines
}

export function phraseRegex(phrases: string[], flags = "gi"): RegExp {
  return new RegExp(`(?<![A-Za-z])(?:${phrases.join("|")})(?![A-Za-z])`, flags)
}

export function findAll(text: string, re: RegExp): Span[] {
  return [...text.matchAll(re)].map((m) => [m.index, m.index + m[0].length])
}

export const squash = (x: number, k: number) =>
  1 - Math.exp(-Math.max(0, x) / k)

export const per100 = (count: number, p: Parsed) =>
  (100 * count) / Math.max(p.words.length, 20)
