import { browser } from "wxt/browser"
import {
  REWRITE_PORT,
  type RewriteEvent,
  type RewriteRequest,
} from "../../shared/messages"

export type RewriteResult = { text: string; removedRuleIds: string[] }

type RewriteHandlers = {
  progress: (textSoFar: string) => void
  done: (result: RewriteResult) => void
  error: (message: string) => void
}

export function streamRewrite(
  request: RewriteRequest,
  handlers: RewriteHandlers
): () => void {
  const port = browser.runtime.connect({ name: REWRITE_PORT })
  let output = ""
  port.onMessage.addListener((event: RewriteEvent) => {
    if (event.kind === "chunk") {
      output += event.text
      handlers.progress(output)
    } else if (event.kind === "error") {
      handlers.error(event.message)
    } else {
      handlers.done(parseRewrite(output))
      port.disconnect()
    }
  })
  port.postMessage(request)
  return () => port.disconnect()
}

const REMOVED_LINE = /\n?[^\S\n]*Removed:(.*)\s*$/i

export function parseRewrite(output: string): RewriteResult {
  const removed = output.match(REMOVED_LINE)
  if (!removed) return { text: output.trim(), removedRuleIds: [] }
  return {
    text: output.slice(0, removed.index).trim(),
    removedRuleIds: removed[1].match(/r-\d+/g) ?? [],
  }
}
