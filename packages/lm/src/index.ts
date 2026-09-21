import {
  AutoModelForCausalLM,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  Tensor,
  env,
} from "@huggingface/transformers"
import { GpuStats, NONE, STATS } from "./reduce.ts"
import { LM_SPEC } from "./spec.ts"

export { checkDevice, toLmError } from "./device.ts"
export { LM_SPEC, type LmError, type LmStatus } from "./spec.ts"

export type LanguageModel = {
  tokenizer: PreTrainedTokenizer
  model: PreTrainedModel
  bos: number
  gpu: Gpu | null
}

const TOKENS_PER_BATCH = 256

const LOW_MEMORY = {
  graphOptimizationLevel: "disabled",
  enableCpuMemArena: false,
  enableMemPattern: false,
} as const

type OrtTensor = { dispose(): void }
type Session = {
  inputMetadata: {
    name: string
    type: "float16" | "float32"
    shape: (number | string)[]
  }[]
  run(
    feeds: Record<string, unknown>,
    fetches: string[] | Record<string, OrtTensor>
  ): Promise<Record<string, OrtTensor>>
}
type Gpu = {
  session: Session
  stats: GpuStats
  vocab: number
  logitsOn(buffer: GPUBuffer, dims: number[]): OrtTensor
}

export function selfHostRuntime(files: { mjs: string; wasm: string }): void {
  const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown } }
  if (onnx.wasm) onnx.wasm.wasmPaths = files
  env.useWasmCache = false
}

export async function loadLanguageModel(
  onProgress?: (loaded: number, total: number) => void
): Promise<LanguageModel> {
  const files = new Map<string, [loaded: number, total: number]>()
  const progress_callback = onProgress
    ? (event: {
        status: string
        file?: string
        loaded?: number
        total?: number
      }) => {
        if (event.status !== "progress" || !event.file || !event.total) return
        files.set(event.file, [event.loaded ?? 0, event.total])
        let loaded = 0
        let total = 0
        for (const [l, t] of files.values()) {
          loaded += l
          total += t
        }
        onProgress(loaded, total)
      }
    : undefined
  const tokenizer = await AutoTokenizer.from_pretrained(LM_SPEC.repo)
  const browser = typeof navigator !== "undefined" && "gpu" in navigator
  const model = await AutoModelForCausalLM.from_pretrained(LM_SPEC.repo, {
    device: LM_SPEC.device,
    dtype: LM_SPEC.dtype,
    progress_callback,
    ...(browser && { session_options: LOW_MEMORY }),
  })
  const gpu = browser ? await shareGpu(model).catch(() => null) : null
  return { tokenizer, model, bos: tokenizer.bos_token_id ?? 0, gpu }
}

async function shareGpu(model: PreTrainedModel): Promise<Gpu | null> {
  const onnx = env.backends.onnx as {
    webgpu?: { device?: GPUDevice | Promise<GPUDevice> }
  }
  const device = await onnx.webgpu?.device
  const session = (model as unknown as { sessions?: { model?: Session } })
    .sessions?.model
  const vocab = (model.config as { vocab_size?: number }).vocab_size
  if (!device || !session?.inputMetadata || !vocab) return null
  const first = await session.run(feeds(session, [[0]]), ["logits"])
  const SessionTensor = first.logits.constructor as unknown as {
    fromGpuBuffer(
      buffer: GPUBuffer,
      options: { dataType: "float32"; dims: number[] }
    ): OrtTensor
  }
  first.logits.dispose()
  if (typeof SessionTensor.fromGpuBuffer !== "function") return null
  return {
    session,
    vocab,
    stats: new GpuStats(device),
    logitsOn: (buffer, dims) =>
      SessionTensor.fromGpuBuffer(buffer, { dataType: "float32", dims }),
  }
}

export async function lmFeatures(
  lm: LanguageModel,
  texts: string[],
  tokensPerBatch = TOKENS_PER_BATCH
): Promise<Float32Array[]> {
  const ids = texts.map((text) => encode(lm, text))
  const features: Float32Array[] = new Array(texts.length)
  const lengths = ids.map((row) => row.length)
  if (lm.gpu) {
    for (const { rows, shape } of packShapes(lengths)) {
      const paragraphs = rows.map((i) => ids[i])
      const batch = await forwardOnGpu(lm.gpu, paragraphs, shape)
      rows.forEach((i, k) => (features[i] = batch[k]))
    }
    return features
  }
  for (const rows of packBatches(lengths, tokensPerBatch)) {
    const batch = await forward(
      lm,
      rows.map((i) => ids[i])
    )
    rows.forEach((i, k) => (features[i] = batch[k]))
  }
  return features
}

export function packBatches(lengths: number[], budget: number): number[][] {
  const order = lengths.map((_, i) => i).sort((a, b) => lengths[a] - lengths[b])
  const batches: number[][] = []
  for (const i of order) {
    const batch = batches.at(-1)
    if (batch && (batch.length + 1) * lengths[i] <= budget) batch.push(i)
    else batches.push([i])
  }
  return batches
}

type Shape = readonly [rows: number, width: number]

const SHAPES: Shape[] = [
  [8, 32],
  [4, 64],
  [2, 128],
  [1, LM_SPEC.maxTokens + 1],
]
const POSITIONS = Math.max(...SHAPES.map(([rows, width]) => rows * width))

export function packShapes(
  lengths: number[]
): { rows: number[]; shape: Shape }[] {
  const batches: { rows: number[]; shape: Shape }[] = []
  const open = new Map<Shape, { rows: number[]; shape: Shape }>()
  lengths.forEach((length, i) => {
    const shape = SHAPES.find(([, width]) => length <= width) ?? SHAPES.at(-1)!
    let batch = open.get(shape)
    if (!batch || batch.rows.length === shape[0]) {
      batch = { rows: [], shape }
      batches.push(batch)
      open.set(shape, batch)
    }
    batch.rows.push(i)
  })
  return batches
}

function encode(lm: LanguageModel, text: string): number[] {
  const ids = lm.tokenizer.encode(text, { add_special_tokens: false })
  return [lm.bos, ...ids.slice(0, LM_SPEC.maxTokens)]
}

function padded(
  paragraphs: number[][],
  [rows, width]: Shape = [
    paragraphs.length,
    Math.max(...paragraphs.map((ids) => ids.length)),
  ]
) {
  const ids = new BigInt64Array(rows * width)
  const mask = new BigInt64Array(rows * width)
  for (let row = 0; row < rows; row++) {
    const tokens = paragraphs[row] ?? paragraphs[0].slice(0, 1)
    tokens.forEach((id, i) => {
      ids[row * width + i] = BigInt(id)
      mask[row * width + i] = 1n
    })
  }
  return { width, ids, mask, shape: [rows, width] }
}

function feeds(session: Session, paragraphs: number[][], fixed?: Shape) {
  const { ids, mask, shape } = padded(paragraphs, fixed)
  const all: Record<string, unknown> = {}
  for (const { name, type, shape: dims } of session.inputMetadata) {
    if (name === "input_ids") all[name] = new Tensor("int64", ids, shape)
    else if (name === "attention_mask") {
      all[name] = new Tensor("int64", mask, shape)
    } else {
      const empty = dims.map((d) =>
        typeof d === "number" ? d : d === "batch_size" ? shape[0] : 0
      )
      const none = type === "float16" ? new Uint16Array(0) : new Float32Array(0)
      all[name] = new Tensor(type, none, empty)
    }
  }
  for (const name in all) all[name] = (all[name] as Tensor).ort_tensor
  return all
}

let turn: Promise<unknown> = Promise.resolve()

function forwardOnGpu(
  gpu: Gpu,
  paragraphs: number[][],
  shape: Shape
): Promise<Float32Array[]> {
  const pass = turn.then(async () => {
    const [rows, width] = shape
    const next = new Uint32Array(rows * width).fill(NONE)
    paragraphs.forEach((tokens, row) => {
      for (let t = 0; t + 1 < tokens.length; t++) {
        next[row * width + t] = tokens[t + 1]
      }
    })
    const buffer = gpu.stats.logits(POSITIONS * gpu.vocab * 4)
    const logits = gpu.logitsOn(buffer, [rows, width, gpu.vocab])
    const outputs = await gpu.session.run(
      feeds(gpu.session, paragraphs, shape),
      { logits }
    )
    try {
      const stats = await gpu.stats.reduce(buffer, next, gpu.vocab)
      return paragraphs.map((tokens, row) =>
        featuresFromStats(stats, row * width, tokens.length - 1)
      )
    } finally {
      for (const tensor of Object.values(outputs)) tensor.dispose()
    }
  })
  turn = pass.catch(() => {})
  return pass
}

async function forward(
  lm: LanguageModel,
  paragraphs: number[][]
): Promise<Float32Array[]> {
  const { width, ids, mask, shape } = padded(paragraphs)
  const outputs = (await lm.model({
    input_ids: new Tensor("int64", ids, shape),
    attention_mask: new Tensor("int64", mask, shape),
  })) as Record<string, Tensor>
  try {
    const { logits } = outputs
    const vocab = logits.dims[2]
    const data = logits.data
    if (!(data instanceof Float32Array)) {
      throw new Error(`expected float32 logits, got ${logits.type}`)
    }
    return paragraphs.map((tokens, row) =>
      featuresFromLogits(data, row * width * vocab, vocab, tokens)
    )
  } finally {
    for (const tensor of Object.values(outputs)) tensor.dispose()
  }
}

export function featuresFromLogits(
  logits: Float32Array,
  offset: number,
  vocab: number,
  tokens: number[]
): Float32Array {
  const n = tokens.length - 1
  const stats = new Float64Array(n * STATS)
  for (let t = 0; t < n; t++) {
    const row = offset + t * vocab
    const target = logits[row + tokens[t + 1]]
    let max = -Infinity
    for (let v = 0; v < vocab; v++) {
      if (logits[row + v] > max) max = logits[row + v]
    }
    let z = 0
    let sx = 0
    let sxx = 0
    let rank = 1
    for (let v = 0; v < vocab; v++) {
      const x = logits[row + v]
      const e = Math.exp(x - max)
      z += e
      sx += e * x
      sxx += e * x * x
      if (x > target) rank++
    }
    const logZ = max + Math.log(z)
    const meanX = sx / z
    stats[t * STATS] = target - logZ
    stats[t * STATS + 1] = logZ - meanX
    stats[t * STATS + 2] = Math.max(sxx / z - meanX * meanX, 0)
    stats[t * STATS + 3] = rank
  }
  return featuresFromStats(stats, 0, n)
}

export function featuresFromStats(
  stats: ArrayLike<number>,
  first: number,
  n: number
): Float32Array {
  let sumObserved = 0
  let sumEntropy = 0
  let sumVar = 0
  let sumLogRank = 0
  let top1 = 0
  let top10 = 0
  const surprisal = new Float64Array(n)
  for (let t = 0; t < n; t++) {
    const at = (first + t) * STATS
    const observed = stats[at]
    const rank = stats[at + 3]
    sumObserved += observed
    sumEntropy += stats[at + 1]
    sumVar += stats[at + 2]
    sumLogRank += Math.log(rank)
    if (rank === 1) top1++
    if (rank <= 10) top10++
    surprisal[t] = -observed
  }
  const mean = (x: number) => x / Math.max(n, 1)
  const meanSurprisal = mean(-sumObserved)
  let squares = 0
  for (const s of surprisal) squares += (s - meanSurprisal) ** 2
  return Float32Array.from([
    mean(sumObserved),
    mean(sumEntropy),
    (sumObserved + sumEntropy) / Math.sqrt(Math.max(sumVar, 1e-6)),
    -mean(sumObserved) / Math.max(mean(sumEntropy), 1e-6),
    mean(sumLogRank),
    mean(top1),
    mean(top10),
    n > 1 ? Math.sqrt(squares / (n - 1)) : 0,
  ])
}
