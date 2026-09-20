import type { LmStatus } from "@slop/lm/spec"
import { browser } from "wxt/browser"
import { SUMMARY_PORT, type Summary, handle, send } from "../../shared/messages"
import {
  DEFAULT_SETTINGS,
  type Settings,
  getSettings,
  onSettingsChanged,
  saveSettings,
} from "../../shared/settings"

export type PopupState = {
  settings: Settings
  summary: Summary | "unavailable" | null
  corrections: number
  rewriteNoteOpen: boolean
  lm: LmStatus | null
}

let state: PopupState = {
  settings: DEFAULT_SETTINGS,
  summary: null,
  corrections: 0,
  rewriteNoteOpen: false,
  lm: null,
}
const listeners = new Set<() => void>()

export const popupStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getState: () => state,
}

function update(patch: Partial<PopupState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

const count = (corrections: unknown) =>
  Array.isArray(corrections) ? corrections.length : 0

async function readLm(settings: Settings) {
  update({ lm: settings.lm ? await send({ type: "lm-status" }) : null })
}

export async function startPopupStore(tabId: number | undefined) {
  const [settings, stored] = await Promise.all([
    getSettings(),
    browser.storage.local.get("corrections"),
  ])
  update({ settings, corrections: count(stored.corrections) })
  void readLm(settings)

  onSettingsChanged(async (changed) => {
    const next = await getSettings()
    update({ settings: next })
    if (changed.has("lm")) void readLm(next)
  })
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.corrections) {
      update({ corrections: count(changes.corrections.newValue) })
    }
  })
  handle("lm-changed", ({ status }) => update({ lm: status }))

  if (tabId === undefined) {
    update({ summary: "unavailable" })
    return
  }
  const port = browser.tabs.connect(tabId, { name: SUMMARY_PORT })
  port.onMessage.addListener((summary: Summary) => update({ summary }))
  port.onDisconnect.addListener(() => {
    void browser.runtime.lastError
    update({ summary: "unavailable" })
  })
}

export async function changeSettings(patch: Partial<Settings>) {
  update({ settings: { ...state.settings, ...patch }, rewriteNoteOpen: false })
  await saveSettings(patch)
}

export function setRewriteNoteOpen(open: boolean) {
  update({ rewriteNoteOpen: open })
}
