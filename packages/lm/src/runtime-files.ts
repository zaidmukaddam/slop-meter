import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const fromHere = createRequire(import.meta.url)
const fromTransformers = createRequire(
  fromHere.resolve("@huggingface/transformers")
)
const dist = dirname(fromTransformers.resolve("onnxruntime-web"))

export const ORT_FILES = {
  mjs: join(dist, "ort-wasm-simd-threaded.asyncify.mjs"),
  wasm: join(dist, "ort-wasm-simd-threaded.asyncify.wasm"),
}
