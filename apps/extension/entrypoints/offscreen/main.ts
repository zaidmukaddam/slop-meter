import {
  type LanguageModel,
  type LmStatus,
  checkDevice,
  lmFeatures,
  loadLanguageModel,
  selfHostRuntime,
  toLmError,
} from "@slop/lm"
import { browser } from "wxt/browser"
import { handle, send } from "../../shared/messages"

const CACHE_LIMIT = 2000

selfHostRuntime({
  mjs: browser.runtime.getURL("/ort/runtime.mjs" as "/"),
  wasm: browser.runtime.getURL("/ort/runtime.wasm" as "/"),
})

const status: LmStatus = {
  status: "loading",
  progress: 0,
  error: null,
  msPerParagraph: null,
}

function changed(patch: Partial<LmStatus>) {
  const percent = Math.round(status.progress * 100)
  Object.assign(status, patch)
  const onlyProgress = Object.keys(patch).join() === "progress"
  if (onlyProgress && Math.round(status.progress * 100) === percent) return
  void send({ type: "lm-changed", status })
}

const model: Promise<LanguageModel> = checkDevice()
  .then(() =>
    loadLanguageModel((loaded, total) =>
      changed({ progress: total ? loaded / total : 0 })
    )
  )
  .then(
    (lm) => {
      changed({ status: "ready", progress: 1 })
      return lm
    },
    (error) => {
      changed({ status: "failed", error: toLmError(error) })
      throw error
    }
  )

const cache = new Map<string, number[]>()

async function features(texts: string[]): Promise<number[][]> {
  const lm = await model
  if (cache.size + texts.length > CACHE_LIMIT) cache.clear()
  const missing = [...new Set(texts.filter((text) => !cache.has(text)))]
  if (missing.length) {
    const started = performance.now()
    const rows = await lmFeatures(lm, missing)
    rows.forEach((row, i) => cache.set(missing[i], Array.from(row)))
    changed({ msPerParagraph: (performance.now() - started) / missing.length })
  }
  return texts.map((text) => cache.get(text)!)
}

handle("lm-state", () => status)
handle("lm-run", ({ texts }) =>
  features(texts).then(
    (rows) => ({ features: rows }),
    (error) => ({ error: toLmError(error) })
  )
)
