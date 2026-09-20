import {
  type LanguageModel,
  type LmError,
  checkDevice,
  lmFeatures,
  loadLanguageModel,
  toLmError,
} from "@slop/lm"

export type WorkerCall =
  { type: "load" } | { type: "features"; texts: string[] }
export type WorkerRequest = WorkerCall & { id: number }
export type WorkerReply =
  | { type: "progress"; loaded: number; total: number }
  | { id: number; type: "done"; features: Float32Array[] }
  | { id: number; type: "error"; error: LmError }

let lm: Promise<LanguageModel> | null = null
const reply = (message: WorkerReply) => postMessage(message)

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    lm ??= checkDevice().then(() =>
      loadLanguageModel((loaded, total) =>
        reply({ type: "progress", loaded, total })
      )
    )
    const model = await lm
    const features =
      data.type === "features" ? await lmFeatures(model, data.texts) : []
    reply({ id: data.id, type: "done", features })
  } catch (error) {
    reply({ id: data.id, type: "error", error: toLmError(error) })
  }
}
