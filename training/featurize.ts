import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import {
  FEATURE_DIM,
  FEATURE_NAMES,
  SPEC_VERSION,
  extract,
} from "@slop/features"

const corpus = readFileSync(new URL("data/corpus.jsonl", import.meta.url))
const rows = corpus
  .toString()
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l))
const X = new Float32Array(rows.length * FEATURE_DIM)
const words: number[] = []
const t0 = performance.now()
rows.forEach((r, i) => {
  const features = extract(r.text)
  X.set(features.values, i * FEATURE_DIM)
  words.push(features.words)
})
const ms = (performance.now() - t0) / rows.length
writeFileSync(new URL("data/X.f32", import.meta.url), X)
writeFileSync(
  new URL("data/meta.json", import.meta.url),
  JSON.stringify({
    spec: SPEC_VERSION,
    dim: FEATURE_DIM,
    names: FEATURE_NAMES,
    msPerParagraph: ms,
    corpus: createHash("sha256").update(corpus).digest("hex"),
    rows: rows.map(({ label, split, source, domain, model, modern }, i) => ({
      label,
      split,
      source,
      domain,
      model,
      modern,
      words: words[i],
    })),
  })
)
console.log(
  `${rows.length} paragraphs x ${FEATURE_DIM} features, ${ms.toFixed(3)} ms/paragraph`
)
