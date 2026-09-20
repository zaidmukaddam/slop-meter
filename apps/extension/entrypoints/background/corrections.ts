import { isCorrection } from "@slop/model"
import { browser } from "wxt/browser"
import { API_BASE } from "../../shared/api"
import type { StoredCorrection } from "../../shared/messages"
import { installId } from "./install-id"

const SYNC_BATCH = 100

type Stored = {
  corrections?: StoredCorrection[]
  synced?: number
  share?: boolean
}

const store = browser.storage.local
let appending: Promise<unknown> = Promise.resolve()
let syncing = false

export function appendCorrection(raw: StoredCorrection): Promise<boolean> {
  const saved = appending.then(async () => {
    const { ts, ...item } = raw
    if (!isCorrection(item) || !Number.isFinite(ts)) return false
    const { corrections = [] }: Stored = await store.get("corrections")
    await store.set({ corrections: [...corrections, { ...item, ts }] })
    return true
  })
  const settled = saved.catch(() => false)
  appending = settled
  return settled
}

export async function syncCorrections(): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    const stored: Stored = await store.get(["share", "corrections", "synced"])
    if (stored.share)
      await uploadFrom(stored.synced ?? 0, stored.corrections ?? [])
  } catch {
  } finally {
    syncing = false
  }
}

async function uploadFrom(synced: number, corrections: StoredCorrection[]) {
  for (let start = synced; start < corrections.length; start += SYNC_BATCH) {
    const items = corrections
      .slice(start, start + SYNC_BATCH)
      .map(({ ts: _localOnly, ...item }) => item)
    const response = await fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ installId: await installId(), items }),
    })
    if (!response.ok) return
    await store.set({
      synced: Math.min(start + SYNC_BATCH, corrections.length),
    })
  }
}
