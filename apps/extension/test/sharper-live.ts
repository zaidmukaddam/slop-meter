import { join } from "node:path"
import type { browser } from "wxt/browser"
import { launch, openPopup, readMarks, waitForMarks } from "./browser.ts"
import { SCORED_BLOCKS } from "./fixtures.ts"
import { PAGES, startPageServer, stopServer } from "./servers.ts"

declare const chrome: typeof browser

const server = await startPageServer()
const context = await launch(
  join(import.meta.dirname, "..", ".output/chrome-mv3")
)
const worker =
  context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
const page = await context.newPage()
await page.goto(`${PAGES}/`)
await waitForMarks(page, Object.keys(SCORED_BLOCKS).length)
const before = await readMarks(page)

const started = Date.now()
await worker.evaluate(() => chrome.storage.local.set({ lm: true }))
const extensionId = new URL(worker.url()).host
let status = ""
for (let i = 0; i < 120 && !/ms a paragraph|Couldn't/.test(status); i++) {
  await page.waitForTimeout(2000)
  const popup = await openPopup(context, extensionId, page)
  status = await popup
    .getByText(/Downloading|On\.|Couldn't/)
    .first()
    .innerText()
  await popup.close()
}
const after = await readMarks(page)
const offscreen = await worker.evaluate(() => chrome.offscreen.hasDocument())
console.log(
  `popup after ${((Date.now() - started) / 1000).toFixed(0)} s: ${status}`
)
console.log(`offscreen page open: ${offscreen}`)
console.log("base marks   ", JSON.stringify(before))
console.log("sharper marks", JSON.stringify(after))

await worker.evaluate(() => chrome.storage.local.set({ lm: false }))
await page.waitForTimeout(2000)
console.log("switched off ", JSON.stringify(await readMarks(page)))
console.log(
  `offscreen page open after off: ${await worker.evaluate(() => chrome.offscreen.hasDocument())}`
)
await context.close()
await stopServer(server)
