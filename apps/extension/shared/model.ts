import type { LmError } from "@slop/lm/spec"
import { type Manifest, type Score, Scorer } from "@slop/model"
import manifest from "@slop/model/manifest.json"
import { browser } from "wxt/browser"
import { requestLmFeatures } from "./messages"

export { manifest }

const packed = async (path: string) => {
  const response = await fetch(browser.runtime.getURL(path as "/"))
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response
}

export async function loadScorer(): Promise<Scorer> {
  const weights = await (await packed("/model.bin")).arrayBuffer()
  return Scorer.create(manifest, weights)
}

async function attachLm(scorer: Scorer): Promise<void> {
  if (scorer.lmAttached) return
  const [lmManifest, weights] = await Promise.all([
    packed("/model-lm.json").then((r) => r.json() as Promise<Manifest>),
    packed("/model-lm.bin").then((r) => r.arrayBuffer()),
  ])
  scorer.useLm(lmManifest, weights)
}

export async function sharpen(
  scorer: Scorer,
  texts: string[]
): Promise<Score[] | LmError> {
  const [reply] = await Promise.all([
    requestLmFeatures(texts),
    attachLm(scorer),
  ])
  if ("error" in reply) return reply.error
  return texts.map((text, i) =>
    scorer.score(text, Float32Array.from(reply.features[i]))
  )
}
