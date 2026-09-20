import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { LM_SPEC, lmFeatures, loadLanguageModel } from "@slop/lm"

const corpus = readFileSync(new URL("data/corpus.jsonl", import.meta.url))
const texts = corpus
  .toString()
  .trim()
  .split("\n")
  .map((l) => (JSON.parse(l) as { text: string }).text)
const { repo, dtype, maxTokens, features } = LM_SPEC
const lm = await loadLanguageModel()
const started = performance.now()
const rows = await lmFeatures(lm, texts, 2048)
const X = new Float32Array(texts.length * features.length)
rows.forEach((row, i) => X.set(row, i * features.length))
writeFileSync(new URL("data/lm.f32", import.meta.url), X)
writeFileSync(
  new URL("data/lm.json", import.meta.url),
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
  `${texts.length} paragraphs x ${features.length} LM features in ${((performance.now() - started) / 60000).toFixed(1)} min`
)
