import {
  AutoModelForCausalLM,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  Tensor,
  env,
} from "@huggingface/transformers"
import { LM_SPEC } from "./spec.ts"

export { checkDevice, toLmError } from "./device.ts"
export { LM_SPEC, type LmError, type LmStatus } from "./spec.ts"

export type LanguageModel = {
  tokenizer: PreTrainedTokenizer
  model: PreTrainedModel
  bos: number
}

const TOKENS_PER_BATCH = 256

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
  const model = await AutoModelForCausalLM.from_pretrained(LM_SPEC.repo, {
    device: LM_SPEC.device,
    dtype: LM_SPEC.dtype,
    progress_callback,
  })
  return { tokenizer, model, bos: tokenizer.bos_token_id ?? 0 }
}

export async function lmFeatures(
  lm: LanguageModel,
  texts: string[],
  tokensPerBatch = TOKENS_PER_BATCH
): Promise<Float32Array[]> {
  const ids = texts.map((text) => encode(lm, text))
  const features: Float32Array[] = new Array(texts.length)
  const lengths = ids.map((row) => row.length)
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

function encode(lm: LanguageModel, text: string): number[] {
  const ids = lm.tokenizer.encode(text, { add_special_tokens: false })
  return [lm.bos, ...ids.slice(0, LM_SPEC.maxTokens)]
}

async function forward(
  lm: LanguageModel,
  paragraphs: number[][]
): Promise<Float32Array[]> {
  const width = Math.max(...paragraphs.map((ids) => ids.length))
  const ids = new BigInt64Array(paragraphs.length * width)
  const mask = new BigInt64Array(paragraphs.length * width)
  paragraphs.forEach((tokens, row) => {
    tokens.forEach((id, i) => {
      ids[row * width + i] = BigInt(id)
      mask[row * width + i] = 1n
    })
  })
  const shape = [paragraphs.length, width]
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
  let sumObserved = 0
  let sumEntropy = 0
  let sumVar = 0
  let sumLogRank = 0
  let top1 = 0
  let top10 = 0
  const surprisal = new Float64Array(n)
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
    const observed = target - logZ
    const entropy = logZ - meanX
    sumObserved += observed
    sumEntropy += entropy
    sumVar += Math.max(sxx / z - meanX * meanX, 0)
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
