import { browser } from "wxt/browser"
import { defineBackground } from "wxt/utils/define-background"
import { handle, send, sendToTab } from "../../shared/messages"
import { getSettings } from "../../shared/settings"
import { appendCorrection, syncCorrections } from "./corrections"
import { syncOffscreen } from "./offscreen"
import { serveRewrites } from "./rewrite"

const SCORE_SELECTION = "score-selection"

export default defineBackground(() => {
  handle("correct", ({ item }) => appendCorrection(item))

  handle("lm-open", () => syncOffscreen())

  handle("lm-status", async () => {
    if (!(await getSettings()).lm) return null
    const notOpen = await syncOffscreen()
    if (notOpen) {
      return {
        status: "failed",
        progress: 0,
        error: notOpen,
        msPerParagraph: null,
      }
    }
    return send({ type: "lm-state" })
  })

  browser.storage.onChanged.addListener((changes, area) => {
    const shareTurnedOn = changes.share?.newValue === true
    if (area === "local" && (shareTurnedOn || changes.corrections)) {
      syncCorrections()
    }
    if (area === "local" && changes.lm) syncOffscreen()
  })

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: SCORE_SELECTION,
      title: "Score with Slop Meter",
      contexts: ["selection"],
    })
  })
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === SCORE_SELECTION && tab?.id !== undefined) {
      sendToTab(tab.id, { type: "score-selection" })
    }
  })

  syncCorrections()
  syncOffscreen()
  serveRewrites()
})
