export const LM_SPEC = {
  repo: "onnx-community/SmolLM2-135M-ONNX",
  device: "webgpu",
  dtype: "q4f16",
  maxTokens: 256,
  features: [
    "lm:logp",
    "lm:entropy",
    "lm:fastdetect",
    "lm:binoculars",
    "lm:logrank",
    "lm:top1",
    "lm:top10",
    "lm:surprisal-std",
  ],
} as const

export type LmStatus = {
  status: "loading" | "ready" | "failed"
  progress: number
  error: LmError | null
  msPerParagraph: number | null
}

export type LmError = {
  message: string
  retry: boolean
}
