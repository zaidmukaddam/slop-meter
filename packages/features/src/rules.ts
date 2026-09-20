import * as L from "./lexicons.ts"
import {
  type Parsed,
  type Sentence,
  type Span,
  findAll,
  per100,
  phraseRegex,
  squash,
} from "./text.ts"

export type RuleResult = { value: number; spans: Span[] }
type Extractor = (p: Parsed) => RuleResult

const LEADING_PUNCTUATION = `[\\s"'“(*-]*`

const anyOf = (items: string[]) => items.join("|")
const openerRegex = (items: string[]) =>
  new RegExp(`^${LEADING_PUNCTUATION}(${anyOf(items)})\\b`, "i")
const union = (flags: string, ...parts: RegExp[]) =>
  new RegExp(parts.map((r) => r.source).join("|"), flags)

const TRANSITION_OPENER = openerRegex(L.SENTENCE_TRANSITIONS)
const RECAP_OPENER = openerRegex(L.RECAP_OPENERS)
const POINTER_OPENER = openerRegex(L.POINTER_OPENERS)
const HEDGE = new RegExp(`\\b(${anyOf(L.HEDGES)})\\b`, "gi")
const OPINION = new RegExp(`\\b(${anyOf(L.OPINION_MARKERS)})\\b`, "i")
const PARTICIPLE_TAIL = new RegExp(
  `,\\s+(${anyOf(L.ANALYSIS_PARTICIPLES)})\\b[^.!?]*[.!?]`,
  "gi"
)
const PASSIVE = new RegExp(
  `\\b(?:is|are|was|were|be|been|being|gets?|got)\\s+(?:\\w+ly\\s+)?` +
    `(?:\\w+ed|${anyOf(L.IRREGULAR_PARTICIPLES)})\\b`,
  "i"
)
const FROM_TO =
  /\bfrom\s+(?:the\s+)?[a-z][\w-]*(?:\s+[a-z][\w-]*){0,3}\s+to\s+(?:the\s+)?[a-z][\w-]*(?:\s+[a-z][\w-]*){0,3}/gi
const REAL_RANGE = new RegExp(
  `\\bfrom\\s+(?:${anyOf(L.REAL_RANGE_STARTS)})`,
  "i"
)

const NOT_JUST_BUT =
  /not (?:just|only|merely|simply)\b[^.!?;]{1,80}?\b(?:but|it'?s|it is|they'?re|they are)\b/
const ITS_NOT_ABOUT_ITS =
  /it(?:'s| is)(?: not| n't|n't) (?:about|just|only)\b[^.!?]{1,60}?[,;.—–-]\s*it(?:'s| is)\b/
const ISNT_JUST_ITS =
  /isn't (?:just )?(?:a|an|about)\b[^.!?]{1,60}?[,;.—–-]\s*(?:it'?s|it is)\b/
const NO_X_NO_Y_JUST = /no\s+\w+,\s+no\s+\w+[,.]?\s+just\b/
const NEGATIVE_PARALLEL = new RegExp(
  `\\b(${union("", NOT_JUST_BUT, ITS_NOT_ABOUT_ITS, ISNT_JUST_ITS, NO_X_NO_Y_JUST).source})`,
  "gi"
)

const LABEL_THEN_COLON =
  /(?:^|\n)\s*(?:[-*•]|\d+\.)?\s*(?:\*\*|__)[^*_\n]{1,40}(?:\*\*|__)\s*:/
const COLON_INSIDE_LABEL = /(?:^|\n)\s*(?:[-*•]|\d+\.)\s*\*\*[^*\n]{1,40}:\*\*/
const BOLD_LABEL = union("g", LABEL_THEN_COLON, COLON_INSIDE_LABEL)

const DASH = /—|–(?=\s)|\s--\s/g
const CONNECTOR_COLON = /(?<=[a-z0-9)\]"”]):\s+(?=[a-zA-Z])/g
const LIST_LINE = /^\s*(?:[-*•▪◦]|\d+[.)])\s+/
const STAGED_QUESTION =
  /(?:^|[.!?]\s+)((?:the|so|and|but)?\s*\w+(?:\s+\w+){0,4}\?)\s+(?=[A-Z])/g
const TRIAD =
  /\b[\w'-]+(?:\s+[\w'-]+){0,2},\s+[\w'-]+(?:\s+[\w'-]+){0,2},?\s+(?:and|or)\s+[\w'-]+/gi
const EMOJI = /\p{Extended_Pictographic}/gu
const CURLY_QUOTE = /[“”‘’]/g
const STRAIGHT_QUOTE = /["']/g
const CONTRACTION = /'(?:s|t|re|ve|ll|d|m)$/

const MIN_WORDS_FOR_VOICE = 40
const TTR_WINDOW = 40
const FRAGMENT_MAX_WORDS = 4
const LABEL_MAX_WORDS = 3

const sentenceText = (p: Parsed, s: Sentence) => p.text.slice(s.start, s.end)
const sentenceSpan = (s: Sentence): Span => [s.start, s.end]
const firstWordSpan = (s: Sentence): Span => [s.start, s.words[0].end]
const perSentence = (count: number, p: Parsed) =>
  count / Math.max(p.sentences.length, 3)
const none: RuleResult = { value: 0, spans: [] }

function lexicon(phrases: string[], k: number): Extractor {
  const re = phraseRegex(phrases)
  return (p) => {
    const spans = findAll(p.text, re)
    return { value: squash(per100(spans.length, p), k), spans }
  }
}

function matchesPerSentence(re: RegExp, k: number): Extractor {
  return (p) => {
    const spans = findAll(p.text, re)
    return { value: squash(perSentence(spans.length, p), k), spans }
  }
}

function paragraphOpener(re: RegExp): Extractor {
  return (p) => {
    const first = p.sentences[0]
    const m = first && re.exec(sentenceText(p, first))
    if (!m) return none
    const end = first.start + m.index + m[0].length
    return { value: 1, spans: [[end - m[1].length, end]] }
  }
}

function transitionOpeners(p: Parsed): RuleResult {
  const spans = p.sentences
    .filter((s) => TRANSITION_OPENER.test(sentenceText(p, s)))
    .map(firstWordSpan)
  return { value: squash(perSentence(spans.length, p), 0.25), spans }
}

function connectorColons(p: Parsed): RuleResult {
  const spans = findAll(p.text, CONNECTOR_COLON).filter(([start]) => {
    const lineStart = p.text.lastIndexOf("\n", start) + 1
    const before = p.text.slice(lineStart, start).trim()
    return before.split(/\s+/).length > LABEL_MAX_WORDS
  })
  return { value: squash(perSentence(spans.length, p), 0.2), spans }
}

function boldLabels(p: Parsed): RuleResult {
  const spans = findAll(p.text, BOLD_LABEL)
  const perLine = spans.length / Math.max(p.lines.length, 1)
  return { value: squash(perLine, 0.2), spans }
}

function titleCaseHeadings(p: Parsed): RuleResult {
  const spans = p.lines.filter(([start, end]) => {
    const line = p.text
      .slice(start, end)
      .replace(/^#+\s*/, "")
      .trim()
    const words = line.split(/\s+/)
    if (words.length < 3 || words.length > 12) return false
    if (/[.!?,;]$/.test(line)) return false
    const major = words.filter((w) => w.length > 3)
    return major.length >= 2 && major.every((w) => /^[A-Z]/.test(w))
  })
  return { value: squash(spans.length, 0.7), spans }
}

function curlyQuoteShare(p: Parsed): RuleResult {
  const curly = findAll(p.raw, CURLY_QUOTE)
  const straight = p.raw.match(STRAIGHT_QUOTE)?.length ?? 0
  const total = curly.length + straight
  return { value: total ? curly.length / total : 0, spans: curly }
}

function listLineShare(p: Parsed): RuleResult {
  const spans = p.lines.filter(([start, end]) =>
    LIST_LINE.test(p.text.slice(start, end))
  )
  return { value: p.lines.length ? spans.length / p.lines.length : 0, spans }
}

function sentenceLengthUniformity(p: Parsed): RuleResult {
  const lengths = p.sentences.map((s) => s.words.length).filter((n) => n > 0)
  if (lengths.length < 3) return none
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const variance =
    lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length
  const value = Math.min(
    1,
    Math.max(0, 1 - Math.sqrt(variance) / Math.max(mean, 1))
  )
  const spans = value > 0.6 ? p.sentences.map(sentenceSpan) : []
  return { value, spans }
}

function adverbDensity(p: Parsed): RuleResult {
  const adverbs = p.words.filter(
    (w) =>
      w.lower.length > 4 &&
      w.lower.endsWith("ly") &&
      !L.NOT_ADVERBS.has(w.lower)
  )
  return {
    value: squash(per100(adverbs.length, p), 4),
    spans: adverbs.map((w): Span => [w.start, w.end]),
  }
}

function passiveShare(p: Parsed): RuleResult {
  const passive = p.sentences.filter((s) => PASSIVE.test(sentenceText(p, s)))
  const value = p.sentences.length ? passive.length / p.sentences.length : 0
  return { value, spans: passive.map(sentenceSpan) }
}

function hedgingStacks(p: Parsed): RuleResult {
  const stacked = p.sentences.filter(
    (s) => (sentenceText(p, s).match(HEDGE)?.length ?? 0) >= 2
  )
  return {
    value: squash(perSentence(stacked.length, p), 0.3),
    spans: stacked.map(sentenceSpan),
  }
}

function lexicalDiversity(p: Parsed): RuleResult {
  const words = p.words.map((w) => w.lower)
  if (words.length < 15) return none
  if (words.length <= TTR_WINDOW) {
    return { value: new Set(words).size / words.length, spans: [] }
  }
  let sum = 0
  for (let i = 0; i + TTR_WINDOW <= words.length; i++) {
    sum += new Set(words.slice(i, i + TTR_WINDOW)).size / TTR_WINDOW
  }
  return { value: sum / (words.length - TTR_WINDOW + 1), spans: [] }
}

function longWordShare(p: Parsed): RuleResult {
  const long = p.words.filter(
    (w) => w.lower.length >= 10 && /^[a-z]/.test(w.lower)
  )
  const share = long.length / Math.max(p.words.length, 20)
  return {
    value: squash(share, 0.12),
    spans: long.map((w): Span => [w.start, w.end]),
  }
}

function stopStartFragments(p: Parsed): RuleResult {
  const spans: Span[] = []
  let run: Span[] = []
  const endRun = () => {
    if (run.length >= 2) spans.push(...run)
    run = []
  }
  for (const s of p.sentences) {
    if (s.words.length <= FRAGMENT_MAX_WORDS) run.push(sentenceSpan(s))
    else endRun()
  }
  endRun()
  return { value: squash(perSentence(spans.length, p), 0.3), spans }
}

function falseRanges(p: Parsed): RuleResult {
  const spans = findAll(p.text, FROM_TO).filter(
    ([start, end]) => !REAL_RANGE.test(p.text.slice(start, end))
  )
  return { value: squash(per100(spans.length, p), 0.8), spans }
}

function stagedQuestions(p: Parsed): RuleResult {
  const spans: Span[] = []
  for (const m of p.text.matchAll(STAGED_QUESTION)) {
    const start = m.index + m[0].indexOf(m[1])
    spans.push([start, start + m[1].length])
  }
  return { value: squash(spans.length, 0.7), spans }
}

function repeatedOpeners(p: Parsed): RuleResult {
  if (p.sentences.length < 3) return none
  const byWord = new Map<string, Span[]>()
  for (const s of p.sentences) {
    const first = s.words[0]
    const spans = byWord.get(first.lower) ?? []
    spans.push([first.start, first.end])
    byWord.set(first.lower, spans)
  }
  const most = [...byWord.values()].sort((a, b) => b.length - a.length)[0]
  if (most.length < 2) return none
  return { value: (most.length - 1) / (p.sentences.length - 1), spans: most }
}

function absenceOfVoice(p: Parsed): RuleResult {
  if (p.words.length < MIN_WORDS_FOR_VOICE) return none
  const firstPerson = p.words.filter((w) => L.FIRST_PERSON.has(w.lower)).length
  const contractions = p.words.filter(
    (w) => CONTRACTION.test(w.lower) && !w.lower.endsWith("'s")
  ).length
  const opinion = OPINION.test(p.text) ? 3 : 0
  const voice = per100(firstPerson + contractions, p) + opinion
  return { value: Math.exp(-voice / 1.5), spans: [] }
}

export const RULE_EXTRACTORS: Record<string, Extractor> = {
  "r-001": lexicon(L.STOCK_VOCABULARY, 2.5),
  "r-002": lexicon(L.COPULA_SUBSTITUTES, 1),
  "r-003": lexicon(L.FILLER_PHRASES, 1),
  "r-004": lexicon(L.CHATBOT_ARTIFACTS, 0.7),
  "r-005": lexicon(L.PROMOTIONAL_ADJECTIVES, 1.5),
  "r-006": lexicon(L.METAPHOR_NOUNS, 1),
  "r-007": transitionOpeners,
  "r-008": lexicon(L.CUTOFF_DISCLAIMERS, 0.5),
  "r-009": matchesPerSentence(DASH, 0.35),
  "r-010": connectorColons,
  "r-011": boldLabels,
  "r-012": titleCaseHeadings,
  "r-013": (p) => {
    const spans = findAll(p.text, EMOJI)
    return { value: squash(per100(spans.length, p), 1), spans }
  },
  "r-014": matchesPerSentence(NEGATIVE_PARALLEL, 0.12),
  "r-015": curlyQuoteShare,
  "r-016": listLineShare,
  "r-017": sentenceLengthUniformity,
  "r-018": adverbDensity,
  "r-019": passiveShare,
  "r-020": hedgingStacks,
  "r-021": matchesPerSentence(TRIAD, 0.35),
  "r-022": lexicalDiversity,
  "r-023": longWordShare,
  "r-024": paragraphOpener(RECAP_OPENER),
  "r-025": stopStartFragments,
  "r-026": falseRanges,
  "r-027": paragraphOpener(POINTER_OPENER),
  "r-028": matchesPerSentence(PARTICIPLE_TAIL, 0.2),
  "r-029": stagedQuestions,
  "r-030": repeatedOpeners,
  "r-031": lexicon(L.SIGNIFICANCE_INFLATION, 0.7),
  "r-032": lexicon(L.VAGUE_ATTRIBUTION, 0.7),
  "r-033": lexicon(L.CHALLENGES_ARC, 0.7),
  "r-034": absenceOfVoice,
  "r-035": lexicon(L.UPBEAT_CONCLUSIONS, 0.7),
  "r-038": lexicon(L.BOTH_SIDES, 0.7),
}
