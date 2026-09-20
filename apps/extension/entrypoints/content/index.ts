import { segment } from "@slop/features"
import type { Scorer } from "@slop/model"
import { type Browser, browser } from "wxt/browser"
import { defineContentScript } from "wxt/utils/define-content-script"
import { SUMMARY_PORT, type Summary, handle } from "../../shared/messages"
import { loadScorer, manifest, sharpen } from "../../shared/model"
import { getSettings, isSiteOn, onSettingsChanged } from "../../shared/settings"
import { Card } from "./card"
import { createPageStyle, markBlock, unmarkBlock } from "./marks"
import { type Block, BlockScheduler } from "./scheduler"
import { readSiteClass } from "./site"
import { CardTriggers } from "./triggers"

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  async main() {
    const host = location.hostname
    let settings = await getSettings()
    let loading: Promise<Scorer> | null = null
    let scorer: Scorer | null = null
    let running = false
    let selections = 0
    const summaryPorts = new Set<Browser.runtime.Port>()

    const pageStyle = createPageStyle()
    const scheduler = new BlockScheduler(manifest.minWords, (batch) => {
      batch.forEach(render)
      if (settings.lm) void sharpenBlocks(batch)
      pushSummary()
    })
    const card = new Card(readSiteClass(), () => settings)
    const triggers = new CardTriggers(card, (el) => scheduler.get(el))

    async function getScorer(): Promise<Scorer> {
      loading ??= loadScorer()
      scorer = await loading
      return scorer
    }

    async function start() {
      running = true
      const loaded = await getScorer()
      if (!running) return
      document.documentElement.append(pageStyle)
      card.mount()
      triggers.attach()
      scheduler.start(loaded)
      pushSummary()
    }

    function stop() {
      running = false
      triggers.detach()
      card.unmount()
      for (const block of scheduler.all()) unmarkBlock(block.el)
      scheduler.stop()
      pageStyle.remove()
      pushSummary()
    }

    async function sharpenBlocks(blocks: Block[]) {
      const todo = blocks.filter(
        (b) => b.text && b.score && !b.score.tooShort && !b.score.lm
      )
      if (!todo.length) return
      const texts = todo.map((b) => b.text!)
      const scores = await sharpen(await getScorer(), texts)
      if (!Array.isArray(scores) || !running || !settings.lm) return
      todo.forEach((block, i) => {
        if (block.text !== texts[i]) return
        block.score = scores[i]
        render(block)
      })
      pushSummary()
    }

    function render(block: Block) {
      if (!block.score || block.score.tooShort) unmarkBlock(block.el)
      else markBlock(block.el, block.score)
    }

    function summarize(): Summary {
      if (!running || !scorer) return { host, on: false }
      const counts = { human: 0, machine: 0, mixed: 0, unsure: 0 }
      for (const { score } of scheduler.all()) {
        if (score && !score.tooShort) counts[score.localDecision]++
      }
      return { host, on: true, backend: scorer.backend, counts }
    }

    function pushSummary() {
      if (!summaryPorts.size) return
      const summary = summarize()
      for (const port of summaryPorts) port.postMessage(summary)
    }

    function applySettings() {
      const wanted = isSiteOn(settings, host)
      if (wanted && !running) start()
      if (!wanted && running) stop()
    }

    onSettingsChanged(async (changed) => {
      settings = await getSettings()
      applySettings()
      if (running && changed.has("lm")) {
        if (!settings.lm) scorer?.dropLm()
        scheduler.rescoreAll()
      }
    })

    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== SUMMARY_PORT) return
      summaryPorts.add(port)
      port.onDisconnect.addListener(() => summaryPorts.delete(port))
      port.postMessage(summarize())
    })

    handle("score-selection", async () => {
      const selection = getSelection()
      const paragraphs = segment(selection?.toString() ?? "")
      if (!selection?.rangeCount || !paragraphs.length) return
      const range = selection.getRangeAt(0)
      const token = ++selections
      const loaded = await getScorer()
      card.mount()
      triggers.attach()
      card.openSelection(
        range,
        paragraphs,
        paragraphs.map((p) => loaded.score(p))
      )
      if (!settings.lm) return
      const sharper = await sharpen(loaded, paragraphs)
      if (Array.isArray(sharper) && token === selections && card.isOpen) {
        card.openSelection(range, paragraphs, sharper)
      }
    })

    applySettings()
  },
})
