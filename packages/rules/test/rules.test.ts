import { test } from "node:test"
import assert from "node:assert/strict"
import { validate } from "../validate.ts"
import { RULES, rewriteInstructions } from "../index.ts"

test("shipped rulebook is valid", () => assert.deepEqual(validate(RULES), []))

test("validator catches dupes, bad tiers, missing fields", () => {
  const ok = {
    id: "r-001",
    name: "a",
    tier: "lexical",
    detect: "d",
    fix: "f",
    weight: "learned",
  }
  const errs = validate([
    ok,
    { ...ok },
    { ...ok, id: "r-002", tier: "vibes" },
    { id: "x" },
    { ...ok, id: "r-003", example: { tell: "t" } },
  ])
  assert.ok(errs.some((e) => e.includes("duplicate")))
  assert.ok(errs.some((e) => e.includes("tier must be")))
  assert.ok(errs.some((e) => e.includes("missing name")))
  assert.ok(errs.some((e) => e.includes("id must look like")))
  assert.ok(errs.some((e) => e.includes("example needs plain")))
})

test("rewrite prompt cites every id", () => {
  const p = rewriteInstructions(["r-014"])
  for (const r of RULES) assert.ok(p.includes(r.id))
  assert.ok(p.includes("fix them first: r-014"))
})
