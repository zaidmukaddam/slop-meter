import { FEATURE_NAMES, SPEC_VERSION } from "@slop/features"
import { LM_SPEC } from "@slop/lm/spec"

export const CLASSES = ["human", "machine", "mixed"] as const
export type ModelClass = (typeof CLASSES)[number]

export type Manifest = {
  spec: number
  version: string
  classes: string[]
  features: string[]
  normalization: { mean: number; std: number }
  layers: {
    inputs: number
    outputs: number
    weights: number
    scales: number
    bias: number
  }[]
  temperature: number
  tau: number
  tauMachine: number
  minWords: number
  bytes: number
  params: number
  lm?: { repo: string; dtype: string; maxTokens: number; features: string[] }
}

export type Layer = {
  inputs: number
  outputs: number
  q: Int8Array
  packed: Uint32Array
  scales: Float32Array
  bias: Float32Array
}
export type Model = {
  manifest: Manifest
  mean: Float32Array
  std: Float32Array
  layers: Layer[]
}

export function loadModel(
  manifest: Manifest,
  weights: ArrayBuffer | Uint8Array
): Model {
  if (manifest.classes.join() !== CLASSES.join()) {
    throw new Error(`unexpected class order in manifest: ${manifest.classes}`)
  }
  if (manifest.spec !== SPEC_VERSION) {
    throw new Error(
      `model trained on feature spec ${manifest.spec}, runtime is ${SPEC_VERSION}: retrain or update weights`
    )
  }
  if (manifest.lm) {
    const { repo, dtype, maxTokens, features } = LM_SPEC
    const expected = { repo, dtype, maxTokens, features: [...features] }
    if (JSON.stringify(manifest.lm) !== JSON.stringify(expected)) {
      throw new Error(
        "sharper model was trained on other language-model features: retrain with --lm"
      )
    }
  }
  const inputs = [...FEATURE_NAMES, ...(manifest.lm?.features ?? [])]
  if (manifest.features.join() !== inputs.join()) {
    throw new Error(
      "model inputs don't match the feature spec's names: retrain"
    )
  }
  const bin = weights instanceof ArrayBuffer ? weights : weights.slice().buffer
  if (bin.byteLength !== manifest.bytes)
    throw new Error(
      `model.bin is ${bin.byteLength} bytes, manifest says ${manifest.bytes}`
    )
  const n = manifest.features.length
  return {
    manifest,
    mean: new Float32Array(bin, manifest.normalization.mean, n),
    std: new Float32Array(bin, manifest.normalization.std, n),
    layers: manifest.layers.map((l) => ({
      inputs: l.inputs,
      outputs: l.outputs,
      q: new Int8Array(bin, l.weights, l.inputs * l.outputs),
      packed: new Uint32Array(
        bin,
        l.weights,
        Math.ceil((l.inputs * l.outputs) / 4)
      ),
      scales: new Float32Array(bin, l.scales, l.outputs),
      bias: new Float32Array(bin, l.bias, l.outputs),
    })),
  }
}

export function normalize(model: Model, x: Float32Array): Float32Array {
  const z = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++)
    z[i] = (x[i] - model.mean[i]) / model.std[i]
  return z
}
