import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { RULES } from "@slop/rules"
import {
  ENGLISH_MIN_SHARE,
  FEATURE_DIM,
  FEATURE_NAMES,
  RULE_FEATURE_IDS,
  englishShare,
  extract,
  segment,
  segmentSpans,
} from "../src/index.ts"
import { parse } from "../src/text.ts"

const fired = (text: string, id: string) =>
  extract(text).rules.find((r) => r.id === id)!

const CASES = RULES.flatMap((rule) =>
  rule.example && RULE_FEATURE_IDS.includes(rule.id)
    ? [[rule.id, rule.example.tell, rule.example.plain]]
    : []
)

for (const [id, yes, no] of CASES) {
  test(`${id} fires on its tell and not on the plain version`, () => {
    const y = fired(yes, id),
      n = fired(no, id)
    assert.ok(
      y.value > n.value,
      `${id}: tell ${y.value.toFixed(3)} should exceed plain ${n.value.toFixed(3)}`
    )
  })
}

test("every measured rule has an example, except r-022 (a statistic with no single tell)", () => {
  const covered = new Set([...CASES.map((c) => c[0]), "r-022"])
  assert.deepEqual(
    RULE_FEATURE_IDS.filter((id) => !covered.has(id)),
    []
  )
})

test("every extractor maps to a rulebook entry", () => {
  const ids = new Set(RULES.map((r) => r.id))
  for (const id of RULE_FEATURE_IDS) assert.ok(ids.has(id), id)
})

test("spans point at the offending text", () => {
  const t = "We will delve into it."
  const [s, e] = fired(t, "r-001").spans[0]
  assert.equal(t.slice(s, e), "delve")
  const recap = "“In conclusion, it worked."
  const [rs, re] = fired(recap, "r-024").spans[0]
  assert.equal(recap.slice(rs, re), "In conclusion")
})

test("frozen spec: vector length and order", () => {
  assert.equal(FEATURE_DIM, 176)
  assert.equal(FEATURE_NAMES.length, FEATURE_DIM)
  assert.deepEqual(FEATURE_NAMES.slice(0, 3), ["r-001", "r-002", "r-003"])
  for (const v of extract("Anything at all, really. Two sentences.").values)
    assert.ok(Number.isFinite(v))
})

test("labeled set: machine paragraphs carry more tells than human ones, and extraction is under 1 ms", () => {
  const rows = readFileSync(
    new URL("../../../eval/labeled.jsonl", import.meta.url),
    "utf8"
  )
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
  const mean = (label: string, id: string) => {
    const xs = rows
      .filter((r) => r.label === label)
      .map((r) => fired(r.text, id).value)
    return xs.reduce((a, b) => a + b, 0) / xs.length
  }
  const load = (label: string) =>
    [
      "r-001",
      "r-003",
      "r-005",
      "r-006",
      "r-007",
      "r-031",
      "r-032",
      "r-033",
      "r-035",
    ].reduce((a, id) => a + mean(label, id), 0)
  assert.ok(
    load("machine") > load("human"),
    `machine ${load("machine")} vs human ${load("human")}`
  )
  const t0 = performance.now()
  for (const r of rows) extract(r.text)
  assert.ok(
    (performance.now() - t0) / rows.length < 1,
    "extraction must stay under 1 ms per paragraph"
  )
})

test("a line break before a lowercase word is a wrap, not a sentence end", () => {
  const sentences = (text: string) => parse(text).sentences.length
  assert.equal(
    sentences("The committee met on Friday and\n  agreed to publish. It did."),
    2
  )
  assert.equal(sentences("Results\nThe committee agreed."), 2)
})

test("segment", () => {
  assert.deepEqual(segment("one\n\n\ntwo\r\n\r\nthree"), [
    "one",
    "two",
    "three",
  ])
})

test("English prose clears the language gate and its neighbours don't", () => {
  const english =
    "The plan is simple enough that we can say it in one line, and the rest " +
    "of this page is about what it would cost if we were wrong about that."
  assert.ok(englishShare(english) > 0.25)
  assert.equal(extract(english).english, true)

  const others = [
    "Le plan est assez simple pour tenir en une ligne, et le reste de cette page parle du prix a payer si nous nous trompons sur ce point precis.",
    "El plan es lo bastante sencillo como para decirlo en una linea, y el resto de esta pagina trata de lo que costaria si nos equivocamos.",
    "Der Plan ist einfach genug, um ihn in einer Zeile zu sagen, und der Rest dieser Seite handelt davon, was es kosten wuerde, wenn wir uns irren.",
  ]
  for (const text of others) {
    assert.ok(englishShare(text) < ENGLISH_MIN_SHARE, text.slice(0, 20))
    assert.equal(extract(text).english, false)
  }
})

test("segmentSpans points at exactly what segment returns", () => {
  const text =
    "\n\n  First one here.  \n\n\n---\n\nSecond, after a rule.\nStill the second.\n \n\t\nThird."
  const spans = segmentSpans(text)
  assert.deepEqual(
    spans.map(([start, end]) => text.slice(start, end)),
    segment(text)
  )
  assert.equal(spans.length, 3)
  assert.deepEqual(segmentSpans(""), [])
})

test("curly apostrophes match like straight ones, and still count as curly quotes", () => {
  const straight =
    "That's why, as we've seen, the plan stays simple for teams that ship every week."
  const curly = straight.replaceAll("'", "’")
  for (const id of ["r-024", "r-027", "r-034"]) {
    assert.equal(fired(curly, id).value, fired(straight, id).value, id)
  }
  assert.equal(fired(straight, "r-027").value, 1)
  assert.equal(fired(curly, "r-015").value, 1)
  assert.equal(fired(straight, "r-015").value, 0)
})
