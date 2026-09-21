import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { LM_SPEC, lmFeatures, loadLanguageModel } from "@slop/lm"

const at = (name: string) => new URL(`data/${name}`, import.meta.url)
const corpus = readFileSync(at("corpus.jsonl"))
const texts = corpus
  .toString()
  .trim()
  .split("\n")
  .map((l) => (JSON.parse(l) as { text: string }).text)
const { repo, dtype, maxTokens, features } = LM_SPEC
const width = features.length
const keys = texts.map((t) => createHash("sha1").update(t).digest("hex"))

function earlier(): Map<string, Float32Array> {
  const known = new Map<string, Float32Array>()
  if (![at("lm.f32"), at("lm.keys"), at("lm.json")].every(existsSync)) {
    return known
  }
  const spec = JSON.parse(readFileSync(at("lm.json"), "utf8"))
  const same =
    spec.repo === repo &&
    spec.dtype === dtype &&
    spec.maxTokens === maxTokens &&
    JSON.stringify(spec.features) === JSON.stringify(features)
  if (!same) return known
  const raw = readFileSync(at("lm.f32"))
  const all = new Float32Array(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  )
  const before = readFileSync(at("lm.keys"), "utf8").trim().split("\n")
  if (before.length * width !== all.length) return known
  before.forEach((key, i) =>
    known.set(key, all.subarray(i * width, i * width + width))
  )
  return known
}

const known = earlier()
const missing = texts.flatMap((_, i) => (known.has(keys[i]) ? [] : [i]))
const started = performance.now()
if (missing.length) {
  const lm = await loadLanguageModel()
  const rows = await lmFeatures(
    lm,
    missing.map((i) => texts[i]),
    2048
  )
  rows.forEach((row, n) => known.set(keys[missing[n]], row))
}
const X = new Float32Array(texts.length * width)
keys.forEach((key, i) => X.set(known.get(key) as Float32Array, i * width))
writeFileSync(at("lm.f32"), X)
writeFileSync(at("lm.keys"), keys.join("\n") + "\n")
writeFileSync(
  at("lm.json"),
  JSON.stringify({
    repo,
    dtype,
    maxTokens,
    features,
    rows: texts.length,
    corpus: createHash("sha256").update(corpus).digest("hex"),
  })
)
console.log(
  `${texts.length} paragraphs x ${width} LM features, ${missing.length} new, in ${((performance.now() - started) / 60000).toFixed(1)} min`
)
