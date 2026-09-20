import { type Features, type Span, extract } from "@slop/features"
import { RULE_NAMES } from "@slop/rules/names"
import { cpuRun, forward, gradient, softmax } from "./cpu.ts"
import { GpuRunner } from "./gpu.ts"
import {
  CLASSES,
  type Manifest,
  type Model,
  type ModelClass,
  loadModel,
  normalize,
} from "./weights.ts"
import { RULE_FIRED } from "./words.ts"

export {
  type Correction,
  type SiteClass,
  SITE_CLASSES,
  isCorrection,
} from "./correction.ts"
export { cpuRun, forward } from "./cpu.ts"
export { GpuRunner } from "./gpu.ts"
export {
  CLASSES,
  type Manifest,
  type Model,
  type ModelClass,
  loadModel,
  normalize,
} from "./weights.ts"
export {
  DECISIONS,
  DECISION_LABEL,
  DIAL_ORDER,
  RULE_FIRED,
  cardNote,
  percent,
  reasonCode,
  shownP,
} from "./words.ts"

export type Decision = ModelClass | "unsure"
export type Probs = Record<ModelClass, number>
export type Score = {
  words: number
  vector: Float32Array
  lm?: Float32Array
  rules: Features["rules"]
  probs: Probs
  top: ModelClass
  bar: number
  localDecision: Decision
  localP: number
  tooShort: boolean
  model: Model
}
export type Reason = {
  id: string
  name: string
  tier: string
  value: number
  push: number
  spans: Span[]
}
export type Backend = "webgpu" | "cpu"

const CACHE_LIMIT = 5000

export class Scorer {
  private base: Model
  private sharp: Model | null = null
  private gpu: GpuRunner | null
  private cache = new Map<string, Score>()
  private sharpCache = new Map<string, Score>()

  private constructor(base: Model, gpu: GpuRunner | null) {
    this.base = base
    this.gpu = gpu
  }

  static async create(
    manifest: Manifest,
    weights: ArrayBuffer | Uint8Array,
    options: { backend?: "auto" | Backend; gpu?: GPU } = {}
  ): Promise<Scorer> {
    const model = loadModel(manifest, weights)
    const wantsGpu = options.backend !== "cpu"
    const gpu = wantsGpu
      ? await GpuRunner.create(model, options.gpu).catch(() => null)
      : null
    if (options.backend === "webgpu" && !gpu) {
      throw new Error("WebGPU requested but unavailable")
    }
    return new Scorer(model, gpu)
  }

  get backend(): Backend {
    return this.gpu ? "webgpu" : "cpu"
  }

  get manifest(): Manifest {
    return this.base.manifest
  }

  useLm(manifest: Manifest, weights: ArrayBuffer | Uint8Array): void {
    if (!manifest.lm) throw new Error("not a sharper model: no lm block")
    this.sharp = loadModel(manifest, weights)
    this.sharpCache.clear()
  }

  dropLm(): void {
    this.sharp = null
    this.sharpCache.clear()
  }

  get lmAttached(): boolean {
    return this.sharp !== null
  }

  score(paragraph: string, lm?: Float32Array): Score {
    const sharp = lm && this.sharp
    const cache = sharp ? this.sharpCache : this.cache
    const cached = cache.get(paragraph)
    if (cached) return cached
    const model = sharp || this.base
    const features = extract(paragraph)
    const values = sharp ? concat(features.values, lm) : features.values
    const { logits } = forward(model, normalize(model, values))
    return remember(
      cache,
      model,
      paragraph,
      features,
      logits,
      sharp ? lm : undefined
    )
  }

  async scoreBatch(
    paragraphs: string[],
    lm: (Float32Array | undefined)[] = []
  ): Promise<Score[]> {
    const fresh = [
      ...new Set(
        paragraphs.filter(
          (p, i) => !(lm[i] && this.sharp) && !this.cache.has(p)
        )
      ),
    ]
    if (fresh.length) {
      const dim = this.base.layers[0].inputs
      const features = fresh.map((p) => extract(p))
      const inputs = new Float32Array(fresh.length * dim)
      features.forEach((f, k) =>
        inputs.set(normalize(this.base, f.values), k * dim)
      )
      const logits = await this.run(inputs, fresh.length)
      fresh.forEach((p, k) =>
        remember(
          this.cache,
          this.base,
          p,
          features[k],
          logits.subarray(k * 3, k * 3 + 3)
        )
      )
    }
    return paragraphs.map((p, i) => this.score(p, lm[i]))
  }

  private async run(
    inputs: Float32Array<ArrayBuffer>,
    count: number
  ): Promise<Float32Array> {
    if (this.gpu) {
      try {
        return await this.gpu.run(inputs, count)
      } catch {
        this.gpu = null
      }
    }
    return cpuRun(this.base, inputs, count)
  }
}

export function explain(score: Score, top = 3): Reason[] {
  const { model } = score
  const values = score.lm ? concat(score.vector, score.lm) : score.vector
  const input = normalize(model, values)
  const { hidden } = forward(model, input)
  const target =
    score.localDecision === "unsure" ? "machine" : score.localDecision
  const grad = gradient(model, hidden, CLASSES.indexOf(target))
  const reasons = score.rules.map((rule, i) => ({
    ...rule,
    push: grad[i] * input[i],
    name: RULE_NAMES[rule.id].name,
    tier: RULE_NAMES[rule.id].tier,
  }))
  const relevant = reasons.filter(
    (r) => r.push > 0 && (target === "human" || r.value > RULE_FIRED)
  )
  return relevant.sort((a, b) => b.push - a.push).slice(0, top)
}

function concat(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

function remember(
  cache: Map<string, Score>,
  model: Model,
  paragraph: string,
  features: Features,
  logits: ArrayLike<number>,
  lm?: Float32Array
): Score {
  const { temperature, minWords, tau, tauMachine } = model.manifest
  const [human, machine, mixed] = softmax(logits, temperature)
  const probs = { human, machine, mixed }
  const top = CLASSES.reduce((a, b) => (probs[b] > probs[a] ? b : a))
  const bar = top === "machine" ? tauMachine : tau
  const tooShort = features.words < minWords

  const score: Score = {
    words: features.words,
    vector: features.values,
    lm,
    rules: features.rules,
    probs,
    top,
    bar,
    localDecision: !tooShort && probs[top] >= bar ? top : "unsure",
    localP: probs[top],
    tooShort,
    model,
  }
  if (cache.size > CACHE_LIMIT) cache.clear()
  cache.set(paragraph, score)
  return score
}
