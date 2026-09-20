import type { LmError, LmStatus } from "@slop/lm/spec"
import type { Backend, Correction, Decision } from "@slop/model"
import { browser } from "wxt/browser"

export type StoredCorrection = Correction & { ts: number }

export type Summary =
  | { host: string; on: false }
  | {
      host: string
      on: true
      backend: Backend
      counts: Record<Decision, number>
    }

export type LmFeaturesReply = { features: number[][] } | { error: LmError }

type Messages = {
  correct: [{ item: StoredCorrection }, boolean]
  "lm-open": [{}, LmError | null]
  "lm-status": [{}, LmStatus | null]
  "lm-run": [{ texts: string[] }, LmFeaturesReply]
  "lm-state": [{}, LmStatus]
  "lm-changed": [{ status: LmStatus }, void]
  summary: [{}, Summary]
  "score-selection": [{}, void]
}
type Type = keyof Messages
export type Message<T extends Type = Type> = T extends Type
  ? { type: T } & Messages[T][0]
  : never
type Reply<T extends Type> = Messages[T][1]

export function handle<T extends Type>(
  type: T,
  answer: (message: Message<T>) => Reply<T> | Promise<Reply<T>>
): void {
  browser.runtime.onMessage.addListener((message: Message, _sender, reply) => {
    if (message?.type !== type) return
    Promise.resolve(answer(message as Message<T>)).then(reply, () =>
      reply(undefined)
    )
    return true
  })
}

export async function send<T extends Type>(
  message: Message<T>
): Promise<Reply<T> | null> {
  try {
    return (await browser.runtime.sendMessage(message)) ?? null
  } catch {
    return null
  }
}

export async function sendToTab<T extends Type>(
  tabId: number,
  message: Message<T>
): Promise<Reply<T> | null> {
  try {
    return (await browser.tabs.sendMessage(tabId, message)) ?? null
  } catch {
    return null
  }
}

export async function requestLmFeatures(
  texts: string[]
): Promise<LmFeaturesReply> {
  const notOpen = await send({ type: "lm-open" })
  if (notOpen) return { error: notOpen }
  return (
    (await send({ type: "lm-run", texts })) ?? {
      error: {
        message: "The language model's page didn't answer",
        retry: true,
      },
    }
  )
}

export const SUMMARY_PORT = "summary"
export const REWRITE_PORT = "rewrite"
export const REWRITE_OFF =
  "Rewrite is off. Turn it on from the Slop Meter button in the toolbar."
export type RewriteRequest = { text: string; ruleIds: string[] }
export type RewriteEvent =
  | { kind: "chunk"; text: string }
  | { kind: "done" }
  | { kind: "error"; message: string }
