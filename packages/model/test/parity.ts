import { readFileSync } from "node:fs"
import { create, globals } from "webgpu"
import { extract } from "@slop/features"
import { cpuRun } from "../src/cpu.ts"
import { GpuRunner } from "../src/gpu.ts"
import { loadModel, normalize } from "../src/weights.ts"

Object.assign(globalThis, globals)
const manifest = JSON.parse(
  readFileSync(new URL("../weights/manifest.json", import.meta.url), "utf8")
)
const model = loadModel(
  manifest,
  readFileSync(new URL("../weights/model.bin", import.meta.url))
)
const dawn = create([])
const gpu = await GpuRunner.create(model, dawn)
if (!gpu) {
  console.log(
    "parity: no WebGPU adapter on this machine" +
      (process.env.PARITY_REQUIRED ? "" : ", skipped")
  )
  process.exit(process.env.PARITY_REQUIRED ? 1 : 0)
}
const corpus = readFileSync(
  new URL("../../../eval/labeled.jsonl", import.meta.url),
  "utf8"
)
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l).text as string)
const n = manifest.features.length
const z = new Float32Array(corpus.length * n)
corpus.forEach((t, i) => z.set(normalize(model, extract(t).values), i * n))
const t0 = performance.now()
const g = await gpu.run(z, corpus.length)
const gpuMs = performance.now() - t0
const t1 = performance.now()
const c = cpuRun(model, z, corpus.length)
const cpuMs = performance.now() - t1
let max = 0
for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i] - g[i]))
console.log(
  `parity: ${corpus.length} paragraphs, max |logit delta| ${max.toExponential(2)}, gpu ${gpuMs.toFixed(1)} ms, cpu ${cpuMs.toFixed(1)} ms`
)
;(globalThis as { dawn?: unknown }).dawn = dawn
process.exit(max < 1e-3 ? 0 : 1)
