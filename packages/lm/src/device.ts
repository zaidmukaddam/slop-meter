import type { LmError } from "./spec.ts"

class Unsupported extends Error {}

export async function checkDevice(): Promise<void> {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) {
    throw new Unsupported("It needs WebGPU, which this browser doesn't have")
  }
  if (!adapter.features.has("shader-f16")) {
    throw new Unsupported(
      "It needs a GPU with 16-bit floats, which this one doesn't have"
    )
  }
}

export function toLmError(error: unknown): LmError {
  const message = String((error as Error)?.message ?? error)
  return {
    message: message.split(/\.\s/)[0].replace(/\.$/, "").slice(0, 120),
    retry: !(error instanceof Unsupported),
  }
}
