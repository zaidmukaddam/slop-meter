import { test } from "node:test"
import assert from "node:assert/strict"
import { FEATURE_NAMES } from "@slop/features"
import { isCorrection } from "../src/correction.ts"

test("isCorrection rejects anything that could carry text", () => {
  const ok = {
    vector: FEATURE_NAMES.map(() => 0.1),
    predicted: "machine",
    label: "human",
    p: 0.8,
    siteClass: "blog",
    spec: 3,
    modelVersion: "2026-09-19.6-lm",
  }
  assert.ok(isCorrection(ok))
  assert.ok(!isCorrection({ ...ok, text: "hello" }))
  assert.ok(!isCorrection({ ...ok, modelVersion: "the quick brown fox" }))
  assert.ok(!isCorrection({ ...ok, vector: [...ok.vector.slice(1), "x"] }))
  assert.ok(!isCorrection({ ...ok, vector: ok.vector.slice(1) }))
  assert.ok(!isCorrection({ ...ok, p: 1.2 }))
  assert.ok(!isCorrection({ ...ok, label: "robot" }))
  assert.ok(!isCorrection({ ...ok, label: "unsure" }))
  assert.ok(!isCorrection({ ...ok, siteClass: "https://example.com" }))
})
