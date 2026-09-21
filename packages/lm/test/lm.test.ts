import { test } from "node:test"
import assert from "node:assert/strict"
import {
  LM_SPEC,
  featuresFromLogits,
  featuresFromStats,
  packBatches,
} from "../src/index.ts"

const LM_FEATURE_NAMES = LM_SPEC.features

function reference(logits: number[][], tokens: number[]): number[] {
  const n = tokens.length - 1
  const rows = logits.slice(0, n).map((row) => {
    const max = Math.max(...row)
    const logZ = max + Math.log(row.reduce((s, x) => s + Math.exp(x - max), 0))
    const logp = row.map((x) => x - logZ)
    const p = logp.map(Math.exp)
    const observed = logp[tokens[logits.indexOf(row) + 1]]
    const entropy = -p.reduce((s, pi, v) => s + pi * logp[v], 0)
    const mean = p.reduce((s, pi, v) => s + pi * logp[v], 0)
    const variance = p.reduce((s, pi, v) => s + pi * (logp[v] - mean) ** 2, 0)
    const rank = 1 + logp.filter((l) => l > observed).length
    return { observed, entropy, variance, rank }
  })
  const sum = (f: (r: (typeof rows)[number]) => number) =>
    rows.reduce((s, r) => s + f(r), 0)
  const surprisal = rows.map((r) => -r.observed)
  const meanS = surprisal.reduce((a, b) => a + b, 0) / n
  return [
    sum((r) => r.observed) / n,
    sum((r) => r.entropy) / n,
    (sum((r) => r.observed) + sum((r) => r.entropy)) /
      Math.sqrt(sum((r) => r.variance)),
    -sum((r) => r.observed) / n / (sum((r) => r.entropy) / n),
    sum((r) => Math.log(r.rank)) / n,
    rows.filter((r) => r.rank === 1).length / n,
    rows.filter((r) => r.rank <= 10).length / n,
    Math.sqrt(surprisal.reduce((s, x) => s + (x - meanS) ** 2, 0) / (n - 1)),
  ]
}

test("one-pass features match the obvious computation", () => {
  let seed = 7
  const random = () =>
    ((seed = (seed * 16807) % 2147483647) / 2147483647) * 8 - 4
  const vocab = 40
  const tokens = [0, 5, 17, 3, 39, 22, 8]
  const logits = tokens.map(() => Array.from({ length: vocab }, random))
  const flat = Float32Array.from(logits.flat())
  const got = featuresFromLogits(flat, 0, vocab, tokens)
  const want = reference(logits, tokens)
  assert.equal(got.length, LM_FEATURE_NAMES.length)
  want.forEach((w, i) =>
    assert.ok(
      Math.abs(got[i] - w) < 1e-4,
      `${LM_FEATURE_NAMES[i]}: ${got[i]} vs ${w}`
    )
  )
})

test("offsets pick one paragraph out of a padded batch", () => {
  const vocab = 3
  const row = [1, 2, 3]
  const logits = Float32Array.from([...row, ...row, 9, 9, 9, ...row, ...row])
  const alone = featuresFromLogits(
    Float32Array.from([...row, ...row]),
    0,
    vocab,
    [0, 2, 1]
  )
  const second = featuresFromLogits(logits, 3 * vocab, vocab, [0, 2, 1])
  assert.deepEqual([...second], [...alone])
})

test("a row of reduced stats reads the same wherever it sits in the batch", () => {
  const row = [-2, 3, 1.5, 4, -0.5, 2, 0.75, 1]
  const alone = featuresFromStats(row, 0, 2)
  const second = featuresFromStats([...row, 0, 0, 0, 0, ...row], 3, 2)
  assert.deepEqual([...second], [...alone])
  assert.ok(Math.abs(alone[0] - -1.25) < 1e-6, `mean logp ${alone[0]}`)
  assert.equal(alone[5], 0.5)
})

test("batches pack similar lengths under the budget and keep every paragraph once", () => {
  const lengths = [5, 100, 3, 50, 300]
  const batches = packBatches(lengths, 104)
  assert.deepEqual(batches, [[2, 0], [3], [1], [4]])
  for (const batch of batches) {
    const width = Math.max(...batch.map((i) => lengths[i]))
    assert.ok(batch.length === 1 || batch.length * width <= 104)
  }
  assert.deepEqual(batches.flat().sort(), [0, 1, 2, 3, 4])
})
