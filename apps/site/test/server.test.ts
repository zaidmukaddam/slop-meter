import assert from "node:assert/strict"
import { test } from "node:test"
import { spend } from "../lib/server/budget.ts"
import { calibrate, isoWeek } from "../lib/server/calibrate.ts"

test("isoWeek", () => {
  assert.equal(isoWeek(new Date("2021-01-03T12:00:00Z")), "2020-W53")
  assert.equal(isoWeek(new Date("2026-09-19T00:00:00Z")), "2026-W38")
})

test("calibrate: reliability, ECE, unsure rate by week", () => {
  const at = "2026-09-16T00:00:00Z"
  const result = calibrate([
    { predicted: "machine", label: "machine", p: 0.9, created_at: at },
    { predicted: "machine", label: "human", p: 0.9, created_at: at },
    { predicted: "human", label: "human", p: 0.75, created_at: at },
    { predicted: "unsure", label: "machine", p: 0.5, created_at: "2026-09-23" },
  ])
  assert.equal(result.n, 4)
  assert.deepEqual(result.bins.machine, [
    { bin: 9, predicted: 0.9, observed: 0.5, n: 2 },
  ])
  assert.deepEqual(result.bins.human, [
    { bin: 7, predicted: 0.75, observed: 1, n: 1 },
  ])
  assert.ok(Math.abs(result.ece! - (2 * 0.4 + 0.25) / 3) < 1e-9)
  assert.deepEqual(result.unsureByWeek, [
    { week: "2026-W38", n: 3, unsureRate: 0 },
    { week: "2026-W39", n: 1, unsureRate: 1 },
  ])
})

test("spend: every budget counts, any one over refuses", async () => {
  const budgets = (limit: number) => [
    { scope: "test", key: "k", period: "p", limit },
    { scope: "test2", key: "k", period: "p", limit: 100 },
  ]
  assert.equal(await spend(budgets(3), 2), true)
  assert.equal(await spend(budgets(3), 1), true)
  assert.equal(await spend(budgets(3), 1), false)
})
