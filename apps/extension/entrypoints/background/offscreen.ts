import type { LmError } from "@slop/lm/spec"
import { browser } from "wxt/browser"
import { getSettings } from "../../shared/settings"

const PAGE = "/offscreen.html"
let queue: Promise<LmError | null> = Promise.resolve(null)

export function syncOffscreen(): Promise<LmError | null> {
  queue = queue.then(apply, apply)
  return queue
}

async function apply(): Promise<LmError | null> {
  const { lm } = await getSettings()
  try {
    const open = await browser.offscreen.hasDocument()
    if (lm && !open) {
      await browser.offscreen.createDocument({
        url: PAGE,
        reasons: [browser.offscreen.Reason.WORKERS],
        justification: "Runs the opt-in language model on this device.",
      })
    } else if (!lm && open) {
      await browser.offscreen.closeDocument()
    }
    return lm ? null : { message: "Sharper reading is off", retry: false }
  } catch (error) {
    return { message: String((error as Error)?.message ?? error), retry: true }
  }
}
