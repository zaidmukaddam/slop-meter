import { type Browser, browser } from "wxt/browser"
import { API_BASE, API_HOST } from "../../shared/api"
import {
  REWRITE_OFF,
  REWRITE_PORT,
  type RewriteEvent,
  type RewriteRequest,
} from "../../shared/messages"

const HTTP_TOO_MANY_REQUESTS = 429
const RULE_ID = /^r-\d+$/

export function serveRewrites(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === REWRITE_PORT) handlePort(port)
  })
}

function handlePort(port: Browser.runtime.Port): void {
  const abort = new AbortController()
  port.onDisconnect.addListener(() => abort.abort())
  const send = (event: RewriteEvent) => {
    try {
      port.postMessage(event)
    } catch {
      abort.abort()
    }
  }
  port.onMessage.addListener(async (request: RewriteRequest) => {
    try {
      await rewrite(request, abort.signal, send)
    } catch (error) {
      if (abort.signal.aborted) return
      const message =
        error instanceof TypeError
          ? `Unable to reach ${API_HOST}. Check your connection and try again.`
          : error instanceof Error
            ? error.message
            : String(error)
      send({ kind: "error", message })
    }
  })
}

async function rewrite(
  request: RewriteRequest,
  signal: AbortSignal,
  send: (event: RewriteEvent) => void
): Promise<void> {
  const { rewrite: optedIn } = await browser.storage.local.get("rewrite")
  if (optedIn !== true) {
    send({ kind: "error", message: REWRITE_OFF })
    return
  }
  const response = await fetch(`${API_BASE}/api/rewrite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: String(request.text),
      ruleIds: (request.ruleIds ?? []).filter((id) => RULE_ID.test(id)),
    }),
    signal,
  })
  if (!response.ok || !response.body) {
    const overBudget = response.status === HTTP_TOO_MANY_REQUESTS
    throw new Error(
      overBudget
        ? "No rewrites left today. Try again tomorrow."
        : `The rewrite didn't go through (error ${response.status}). Try again in a minute.`
    )
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    send({ kind: "chunk", text: read.value })
  }
  send({ kind: "done" })
}
