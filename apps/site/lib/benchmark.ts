import { extract, segment } from "@slop/features"
import {
  GpuRunner,
  type Model,
  cpuRun,
  loadModel,
  normalize,
} from "@slop/model"
import manifest from "@slop/model/manifest.json"
import { fetchBin } from "./model"

export const BATCH = 256
export const PARITY_TOLERANCE = 1e-3
const RUNS = 5

export type BenchmarkResult = {
  extractMs: number
  cpuMs: number
  gpu:
    | { available: true; ms: number; maxLogitDelta: number }
    | { available: false; reason: string }
}

let gpuRunner: Promise<GpuRunner | null> | null = null

async function medianMs(run: () => unknown): Promise<number> {
  await run()
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now()
    await run()
    times.push(performance.now() - start)
  }
  return times.sort((a, b) => a - b)[Math.floor(RUNS / 2)]
}

function standardizedBatch(
  model: Model,
  texts: string[]
): Float32Array<ArrayBuffer> {
  const paragraphs = texts.flatMap((text) => segment(text))
  const width = model.manifest.features.length
  const batch = new Float32Array(BATCH * width)
  for (let i = 0; i < BATCH; i++) {
    const features = extract(paragraphs[i % paragraphs.length])
    batch.set(normalize(model, features.values), i * width)
  }
  return batch
}

function maxDelta(a: Float32Array, b: Float32Array): number {
  let max = 0
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]))
  return max
}

export async function runBenchmark(texts: string[]): Promise<BenchmarkResult> {
  const model = loadModel(manifest, await fetchBin("/model.bin"))
  const extractStart = performance.now()
  const batch = standardizedBatch(model, texts)
  const extractMs = performance.now() - extractStart
  const cpuMs = await medianMs(() => cpuRun(model, batch, BATCH))

  if (!("gpu" in navigator)) {
    return {
      extractMs,
      cpuMs,
      gpu: {
        available: false,
        reason: window.isSecureContext
          ? "This browser has no WebGPU. Recent Chrome, Edge and Safari do."
          : "WebGPU needs https or localhost. Open this page over https.",
      },
    }
  }
  gpuRunner ??= GpuRunner.create(model).catch(() => null)
  const runner = await gpuRunner
  if (!runner) {
    return {
      extractMs,
      cpuMs,
      gpu: {
        available: false,
        reason:
          "The browser has WebGPU but gave no GPU. Check that hardware acceleration is on in its settings.",
      },
    }
  }
  const ms = await medianMs(() => runner.run(batch, BATCH))
  const maxLogitDelta = maxDelta(
    cpuRun(model, batch, BATCH),
    await runner.run(batch, BATCH)
  )
  return { extractMs, cpuMs, gpu: { available: true, ms, maxLogitDelta } }
}
