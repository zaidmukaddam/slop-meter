import { readFileSync } from "node:fs"
import { join } from "node:path"
import { type Score, Scorer } from "@slop/model"
import lmManifest from "@slop/model/lm/manifest.json"
import manifest from "@slop/model/manifest.json"
import { EXAMPLES, EXAMPLE_LABELS } from "./examples"
import demo from "./models-demo.json"

export type Demo = {
  text: string
  words: number
  source: string
  scores: [standard: Score, sharper: Score]
}

export function weights(name: string): ArrayBuffer {
  const bin = readFileSync(join(process.cwd(), "public", name))
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
}

export async function loadDemo(): Promise<Demo> {
  const example = EXAMPLES.find((e) => e.id === demo.example)!
  const text = example.text.split(/\n\n+/)[demo.paragraph]
  const standard = await Scorer.create(manifest, weights("model.bin"), {
    backend: "cpu",
  })
  const sharper = await Scorer.create(manifest, weights("model.bin"), {
    backend: "cpu",
  })
  sharper.useLm(lmManifest, weights("model-lm.bin"))
  return {
    text,
    words: text.split(/\s+/).length,
    source: EXAMPLE_LABELS[example.id],
    scores: [
      standard.score(text),
      sharper.score(text, Float32Array.from(demo.lm)),
    ],
  }
}
