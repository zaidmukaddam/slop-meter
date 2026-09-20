import type { Parsed } from "./text.ts"

const FUNCTION_WORDS = [
  ...["the", "a", "an", "and", "or", "but", "so", "if", "then", "than"],
  ...["that", "which", "who", "whom", "whose", "this", "these", "those"],
  ...["it", "its", "they", "them", "their", "we", "our", "you", "your"],
  ...["i", "me", "my", "he", "she", "his", "her", "of", "in", "on", "at"],
  ...["by", "for", "with", "from", "to", "into", "onto", "over", "under"],
  ...["about", "after", "before", "between", "through", "during"],
  ...["without", "within", "as", "is", "are", "was", "were", "be", "been"],
  ...["being", "have", "has", "had", "do", "does", "did", "not", "no"],
  ...["can", "could", "will", "would", "shall", "should", "may", "might"],
  ...["must", "just", "very", "really", "also", "only", "even", "still"],
  ...["yet", "here", "there", "when", "where", "why", "how", "what", "all"],
  ...["some", "any", "each", "every", "both", "more", "most", "such", "own"],
  ...["same", "other"],
]
const PUNCTUATION = [",", ";", ":", "(", "!", "?", '"', "'", "-", "—", "…"]
const SENTENCE_LENGTH_BINS = [5, 10, 15, 20, 30, 40, Infinity]

const INFORMAL =
  /\b(lol|lmao|tbh|imo|imho|idk|btw|gonna|wanna|gotta|kinda|sorta|yeah|yep|nope|ok|okay|dunno|ya|y'all|ain't|meh|ugh|huh|wow|damn|crap|stuff|guys|dude|haha|hmm)\b|!!|\?\?|\.\.\.(?!\.)/gi
const CONTRACTION = /'(?:t|re|ve|ll|d|m)$/
const DOUBLE_SPACE = /[^\n ] {2,}[^\n ]/g
const FIRST_PERSON = new Set([
  "i",
  "me",
  "my",
  "i'm",
  "i've",
  "i'd",
  "i'll",
  "mine",
])
const SECOND_PERSON = new Set([
  "you",
  "your",
  "you're",
  "you've",
  "you'll",
  "yours",
])

type Stats = {
  p: Parsed
  words: number
  sentences: number
  chars: number
  lengths: number[]
  wordCounts: Map<string, number>
}

function stats(p: Parsed): Stats {
  const wordCounts = new Map<string, number>()
  for (const w of p.words)
    wordCounts.set(w.lower, (wordCounts.get(w.lower) ?? 0) + 1)
  const lengths = p.sentences.map((s) => s.words.length)
  return {
    p,
    words: Math.max(p.words.length, 1),
    sentences: Math.max(lengths.length, 1),
    chars: Math.max(p.text.length, 1),
    lengths,
    wordCounts,
  }
}

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0
const wordShare = (s: Stats, keep: (lower: string) => boolean) =>
  s.p.words.filter((w) => keep(w.lower)).length / s.words

function properNounShare(s: Stats): number {
  const sentenceStarts = new Set(s.p.sentences.map((x) => x.words[0].start))
  const proper = s.p.words.filter(
    (w) =>
      !sentenceStarts.has(w.start) &&
      w.lower !== "i" &&
      /^[A-Z][a-z]/.test(s.p.text.slice(w.start, w.end))
  )
  return proper.length / s.words
}

function lowercaseStartShare(s: Stats): number {
  const lower = s.p.sentences.filter((x) =>
    /^[a-z]/.test(s.p.text[x.words[0].start])
  )
  return lower.length / s.sentences
}

function uppercaseLetterShare(s: Stats): number {
  const letters = s.p.text.match(/[A-Za-z]/g) ?? []
  const upper = letters.filter((c) => c <= "Z").length
  return upper / Math.max(letters.length, 1)
}

function sentenceLengthBin(index: number) {
  const low = SENTENCE_LENGTH_BINS[index - 1] ?? 0
  const high = SENTENCE_LENGTH_BINS[index]
  return (s: Stats) =>
    s.lengths.filter((n) => n > low && n <= high).length / s.sentences
}

type StyleFeature = [name: string, compute: (s: Stats) => number]

const FEATURES: StyleFeature[] = [
  ...FUNCTION_WORDS.map((w): StyleFeature => [
    `fw:${w}`,
    (s) => (s.wordCounts.get(w) ?? 0) / s.words,
  ]),
  ...PUNCTUATION.map((c): StyleFeature => [
    `punct:${c}`,
    (s) => (100 * (s.p.raw.split(c).length - 1)) / s.chars,
  ]),
  ["char:digit", (s) => count(s.p.text, /\d/g) / s.chars],
  ["char:upper", uppercaseLetterShare],
  ...SENTENCE_LENGTH_BINS.map((bin, i): StyleFeature => [
    `sentlen:<=${bin}`,
    sentenceLengthBin(i),
  ]),
  [
    "len:mean-sentence",
    (s) => s.lengths.reduce((a, b) => a + b, 0) / s.sentences / 30,
  ],
  [
    "len:mean-word",
    (s) => s.p.words.reduce((a, w) => a + w.end - w.start, 0) / s.words / 6,
  ],
  ["len:log-words", (s) => Math.log1p(s.p.words.length) / 6],
  ["len:log-sentences", (s) => Math.log1p(s.p.sentences.length) / 3],
  ["human:contractions", (s) => wordShare(s, (w) => CONTRACTION.test(w))],
  ["human:first-person", (s) => wordShare(s, (w) => FIRST_PERSON.has(w))],
  ["human:second-person", (s) => wordShare(s, (w) => SECOND_PERSON.has(w))],
  ["human:informal", (s) => count(s.p.text, INFORMAL) / s.words],
  ["human:lowercase-start", lowercaseStartShare],
  ["human:double-space", (s) => count(s.p.text, DOUBLE_SPACE) / s.sentences],
  ["human:proper-nouns", properNounShare],
  ["human:parens", (s) => count(s.p.text, /\(/g) / s.sentences],
  ["human:questions", (s) => count(s.p.text, /\?/g) / s.sentences],
]

export const STYLE_NAMES = FEATURES.map(([name]) => name)

export function style(p: Parsed): number[] {
  const s = stats(p)
  return FEATURES.map(([, compute]) => compute(s))
}
