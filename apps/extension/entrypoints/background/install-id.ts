import { browser } from "wxt/browser"

let pending: Promise<string> | null = null

export function installId(): Promise<string> {
  pending ??= readOrCreate()
  return pending
}

async function readOrCreate(): Promise<string> {
  const { installId: stored } = await browser.storage.local.get("installId")
  if (typeof stored === "string") return stored
  const fresh = crypto.randomUUID()
  await browser.storage.local.set({ installId: fresh })
  return fresh
}
