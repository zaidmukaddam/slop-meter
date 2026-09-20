import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { Scorer, isRead } from "@slop/model"
import {
  type PostFacts,
  body,
  plain,
} from "../lib/posts/introducing-slop-meter.ts"

const read = (path: string) => readFileSync(new URL(path, import.meta.url))
const manifest = JSON.parse(
  read("../../../packages/model/weights/manifest.json").toString()
)
const scorer = await Scorer.create(
  manifest,
  read("../../../packages/model/weights/model.bin"),
  { backend: "cpu" }
)

const FACTS: PostFacts = {
  kb: "56 KB",
  numbers: "176",
  rules: "38",
  heldOut: "13,615",
  answers: "9%",
  right: "98%",
  humanCalledMachine: "0.1%",
  webN: "24,000",
  webMachine: "0.4%",
  sharperAnswers: "22%",
  download: "125 MB",
  source: null,
}

const paragraphs = body(FACTS).flatMap((block) =>
  block.kind === "p" ? [plain(block.text)] : []
)

test("the launch post does not read as machine-written to the meter it launches", () => {
  for (const text of paragraphs) {
    const score = scorer.score(text)
    assert.notEqual(
      score.localDecision,
      "machine",
      `machine-ish at ${score.localP.toFixed(2)}: ${text.slice(0, 60)}`
    )
  }
})

test("the launch post keeps off the rulebook's loudest tells", () => {
  const joined = paragraphs.join("\n")
  assert.ok(!joined.includes("—"), "no em dashes")
  for (const text of paragraphs) {
    const score = scorer.score(text)
    if (!isRead(score)) continue
    const leansMachine = score.top === "machine" && score.probs.machine > 0.8
    assert.ok(
      !leansMachine,
      `leans machine at ${score.probs.machine.toFixed(2)}: ${text.slice(0, 60)}`
    )
  }
})
