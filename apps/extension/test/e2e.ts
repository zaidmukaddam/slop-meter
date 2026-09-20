import { execSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Scorer } from "@slop/model"
import manifestJson from "@slop/model/manifest.json" with { type: "json" }
import type { BrowserContext, Page, Worker } from "playwright-core"
import type { browser } from "wxt/browser"
import {
  cardLocator,
  highlightedText,
  hoverGutter,
  launch,
  measureScroll,
  openPopup,
  readLayout,
  readMarks,
  waitForMarks,
} from "./browser.ts"
import {
  BREAKS_PARAGRAPHS,
  HUMAN,
  LONG_PAGE_PARAGRAPHS,
  MACHINE,
  NEVER_MARKED,
  SCORED_BLOCKS,
  TEST_PAGE,
  THREAD_COMMENTS,
} from "./fixtures.ts"
import {
  type ApiLog,
  PAGES,
  STUB_API,
  sleep,
  startPageServer,
  startStubApi,
  stopServer,
} from "./servers.ts"

declare const chrome: typeof browser

const PACKAGE_DIR = join(import.meta.dirname, "..")
const EXTENSION_DIR = join(PACKAGE_DIR, ".output/chrome-mv3-e2e")
const SCREENSHOTS = mkdtempSync(join(tmpdir(), "slop-e2e-"))
const SETTLE_MS = 300
const DEFAULT_OFF_WAIT_MS = 1500
const SCORED_COUNT = Object.keys(SCORED_BLOCKS).length
const MIN_MARKED_SHARE = 0.975

let failures = 0
function check(ok: unknown, what: string) {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`)
  if (!ok) failures++
}

const api: ApiLog = { feedback: [], rewrite: [] }

console.log("building extension against the stub API...")
execSync("pnpm wxt build --mode e2e", {
  cwd: PACKAGE_DIR,
  env: { ...process.env, WXT_API_BASE: STUB_API },
  stdio: "ignore",
})
const pageServer = await startPageServer()
const stubApi = await startStubApi(api)
const expected = await expectedMarks()

const layoutWithout = await layoutWithoutExtension()
const context = await launch(EXTENSION_DIR)
const worker =
  context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
const extensionId = new URL(worker.url()).host
const page = await context.newPage()
await page.goto(`${PAGES}/`)
await waitForMarks(page, SCORED_COUNT)

await checkMarks(page, layoutWithout)
await checkHoverCard(page)
await checkKeyboard(page)
await checkCorrection(page, worker)
await checkPopup(context, page)
await checkRewrite(page)
await checkSelection(page, worker)
await checkThread(context)
await checkLineBreaks(context)
await checkSitePolicy(context, page, worker)
await context.close()
await checkJank()

await stopServer(pageServer)
await stopServer(stubApi)
console.log(`\nscreenshots: ${SCREENSHOTS}`)
console.log(failures ? `${failures} check(s) failed` : "all checks passed")
process.exit(failures ? 1 : 0)

async function expectedMarks(): Promise<Record<string, string>> {
  const weights = readFileSync(join(EXTENSION_DIR, "model.bin"))
  const scorer = await Scorer.create(manifestJson, weights, { backend: "cpu" })

  const marks: Record<string, string> = {}
  for (const [id, text] of Object.entries(SCORED_BLOCKS)) {
    const score = scorer.score(text)
    marks[id] = score.localDecision
    console.log(`  ${id} ${marks[id]} ${score.localP.toFixed(2)}`)
  }
  return marks
}

async function layoutWithoutExtension(): Promise<string> {
  const plain = await launch(null)
  const plainPage = await plain.newPage()
  await plainPage.goto(`${PAGES}/`)
  const layout = await readLayout(plainPage)
  await plain.close()
  return layout
}

async function checkMarks(page: Page, layoutWithout: string) {
  const marks = await readMarks(page)
  console.log("marks:", marks)
  check(
    JSON.stringify(marks) === JSON.stringify(expected),
    'marks match the model run in Node on the same serialized text (incl. "- **label:**" list)'
  )
  check(
    MACHINE.every((_, i) => !marks[`m${i}`]?.startsWith("human")),
    "machine paragraphs never marked human-ish"
  )
  check(
    !NEVER_MARKED.some((id) => marks[id]),
    "nav, footer, short, hidden, pre and contenteditable blocks not marked"
  )
  check(
    (await readLayout(page)) === layoutWithout,
    "no layout shift: every element rect identical with and without the extension"
  )
  const lamp = await page.evaluate(() => {
    const el = document.getElementById("m0")!
    const box = el.getBoundingClientRect()
    const lamps = [
      ...document.querySelectorAll<HTMLElement>("slop-marks slop-mark"),
    ]
    const mine = lamps.find((l) => {
      const top = parseFloat(l.style.top) - scrollY
      return top > box.top - 8 && top < box.top + 32
    })
    return {
      lamps: lamps.length,
      marked: document.querySelectorAll("[data-slop]").length,
      left: mine ? box.left - parseFloat(mine.style.left) + scrollX : null,
      color: mine?.style.background ?? "",
      opacity: mine ? parseFloat(mine.style.opacity) : 0,
    }
  })
  check(
    lamp.lamps === lamp.marked,
    `one lamp per marked block (${lamp.lamps} of ${lamp.marked})`
  )
  check(
    lamp.left !== null && lamp.left > 0 && lamp.left < 40,
    `lamp sits in the margin beside the first line (${lamp.left}px left of the text)`
  )
  check(
    /(rgba?|oklch|color|#)/.test(lamp.color) && lamp.opacity > 0.3,
    `lamp carries the answer colour at reading confidence (${lamp.color} @ ${lamp.opacity})`
  )
}

async function checkHoverCard(page: Page) {
  await hoverGutter(page, "m0")
  const text = await cardLocator(page).innerText()
  console.log("card:", text.replace(/\n+/g, " | "))
  const ruleIds = text.match(/r-\d{3}/g) ?? []
  check(
    /machine-ish/.test(text) && /\d+%/.test(text) && ruleIds.length === 3,
    "hover card: decision, probability, three rules"
  )
  const highlights = await highlightedText(page)
  const sample = highlights
    ?.slice(0, 4)
    .map((s) => JSON.stringify(s))
    .join(", ")
  check(
    highlights && highlights.length > 0,
    `span highlights via CSS Custom Highlight API (${highlights?.length} ranges: ${sample})`
  )
  const untouched = await page.evaluate(
    () => document.getElementById("m0")!.childNodes.length === 1
  )
  check(untouched, "highlighting did not mutate the paragraph DOM")
  await page.screenshot({ path: join(SCREENSHOTS, "hover.png") })
  await page.keyboard.press("Escape")
}

async function checkKeyboard(page: Page) {
  await page.mouse.move(0, 0)
  await page.keyboard.press("Tab")
  const focused = () => page.evaluate(() => document.activeElement?.id)
  check((await focused()) === "m0", "marked paragraphs are keyboard focusable")
  const card = cardLocator(page)
  await card.waitFor({ state: "visible", timeout: 3000 })
  check(/machine-ish/.test(await card.innerText()), "focus opens the card")
  check((await highlightedText(page))?.length, "focus highlights the spans")

  await page.keyboard.press("Enter")
  const inCard = await page.evaluate(
    () => document.activeElement?.shadowRoot?.activeElement?.textContent
  )
  check(
    inCard === "You're wrong",
    `Enter moves focus into the card (${inCard})`
  )
  await page.screenshot({ path: join(SCREENSHOTS, "keyboard.png") })

  await page.keyboard.press("Escape")
  await sleep(SETTLE_MS)
  check(!(await card.isVisible()), "Esc closes the card")
  check((await focused()) === "m0", "Esc returns focus to the paragraph")

  await page.keyboard.press("Tab")
  await card.waitFor({ state: "visible", timeout: 3000 })
  check((await focused()) === "m1", "Tab moves to the next mark and its card")
  await page.keyboard.press("Escape")
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur()
  )
}

async function checkCorrection(page: Page, worker: Worker) {
  await hoverGutter(page, "m0")
  await page.locator("slop-card button[data-action=wrong]").click()
  await page.locator("slop-card button[data-label=human]").click()
  await page.locator("slop-card .panel .muted").waitFor()
  const stored = await worker.evaluate(() =>
    chrome.storage.local.get("corrections")
  )
  const correction = (stored.corrections as Record<string, unknown>[])?.[0]
  const keys = correction ? Object.keys(correction).sort().join() : ""
  const summary =
    correction &&
    JSON.stringify({
      ...correction,
      vector: `[${(correction.vector as number[]).length} floats]`,
    })
  check(
    keys === "label,modelVersion,p,predicted,siteClass,spec,ts,vector" &&
      correction?.label === "human",
    `correction stored, numbers only (${summary})`
  )

  await page.locator("slop-card button[data-action=rewrite]").click()
  const panel = await page.locator("slop-card .panel").innerText()
  check(/Rewrite is off/.test(panel), "Rewrite refuses until opted in")
  await page.keyboard.press("Escape")
}

async function checkPopup(context: BrowserContext, page: Page) {
  const popup = await openPopup(context, extensionId, page)
  const text = await popup.locator("main").innerText()
  console.log("popup:", text.replace(/\n+/g, " | "))
  check(
    /\d+% machine-ish/.test(text) && /% human-ish|% can't tell/.test(text),
    "popup shows a distribution"
  )
  check(/WebGPU|CPU/.test(text), "popup shows the backend")
  const sharper = popup.getByRole("switch", { name: "Sharper reading" })
  check(
    (await sharper.getAttribute("aria-checked")) === "false",
    "sharper reading is off until turned on"
  )
  check(/1 correction stored/.test(text), "popup counts stored corrections")

  await popup.getByLabel("Text to score").fill(MACHINE[0])
  await popup.getByRole("button", { name: "Score", exact: true }).click()
  const pasted = popup.locator("section[aria-labelledby=score-title] ul")
  await pasted.waitFor({ timeout: 5000 })
  check(
    /machine-ish \d+%/.test(await pasted.innerText()),
    "the popup scores pasted text"
  )

  await popup
    .getByRole("switch", { name: "Share corrections (numbers only)" })
    .click()
  await popup.waitForTimeout(500)
  const feedback = api.feedback[0] ? JSON.parse(api.feedback[0]) : null
  const itemKeys = feedback?.items?.[0]
    ? Object.keys(feedback.items[0]).sort().join()
    : ""
  check(
    feedback?.installId &&
      feedback.items.length === 1 &&
      itemKeys === "label,modelVersion,p,predicted,siteClass,spec,vector",
    "opt-in sync posts corrections to /api/feedback, numbers only"
  )

  await popup.getByRole("switch", { name: "Rewrite" }).click()
  check(
    await popup.getByText("sends the paragraph").isVisible(),
    "one-time note before enabling Rewrite"
  )
  await popup.getByRole("button", { name: "Turn on Rewrite" }).click()
  await popup.waitForTimeout(SETTLE_MS)
  await popup.screenshot({ path: join(SCREENSHOTS, "popup.png") })
  await popup.close()
}

async function checkRewrite(page: Page) {
  await page.bringToFront()
  await hoverGutter(page, "m0")
  await page.locator("slop-card button[data-action=rewrite]").click()
  const copy = page.locator("slop-card button[data-action=copy]")
  await copy.waitFor({ timeout: 5000 })
  const panel = await page.locator("slop-card .panel").innerText()
  console.log("rewrite panel:", panel.replace(/\n+/g, " | "))
  const insertions = await page.locator("slop-card .rewrite ins").count()
  const deletions = await page.locator("slop-card .rewrite del").count()
  check(
    insertions > 0 && deletions > 0,
    "word diff shows insertions and deletions"
  )
  check(
    /r-001 stock vocabulary/.test(panel),
    "Removed: rule ids shown with names"
  )
  check(
    JSON.parse(api.rewrite[0]).ruleIds.length === 3,
    "rewrite request carries the three rule ids"
  )
  await copy.click()
  await page.waitForTimeout(500)
  const label = await copy.innerText()
  check(label === "Copied", `Copy button (${label})`)
  await page.screenshot({ path: join(SCREENSHOTS, "rewrite.png") })
  await page.keyboard.press("Escape")
}

async function checkSelection(page: Page, worker: Worker) {
  await page.bringToFront()
  const scoreSelection = async (first: string, last: string) => {
    await page.evaluate(
      ([from, to]) => {
        const range = document.createRange()
        range.setStartBefore(document.getElementById(from)!)
        range.setEndAfter(document.getElementById(to)!)
        getSelection()!.removeAllRanges()
        getSelection()!.addRange(range)
      },
      [first, last]
    )
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      })
      await chrome.tabs.sendMessage(tab.id!, { type: "score-selection" })
    })
    await cardLocator(page).waitFor({ state: "visible", timeout: 3000 })
    return cardLocator(page).innerText()
  }

  const one = await scoreSelection("m0", "m0")
  check(
    /machine-ish/.test(one) && /pushed by/i.test(one),
    "a selected paragraph gets the full card"
  )
  await page.keyboard.press("Escape")
  const several = await scoreSelection("m0", "h0")
  check(
    /4 paragraphs/i.test(several),
    "a longer selection lists each paragraph"
  )
  await page.keyboard.press("Escape")
  await page.evaluate(() => getSelection()?.removeAllRanges())
}

async function checkThread(context: BrowserContext) {
  const thread = await context.newPage()
  await thread.goto(`${PAGES}/thread`)
  const read = await thread
    .waitForFunction(
      (n) =>
        [...document.querySelectorAll(".comment")].filter((c) =>
          c.querySelector("[data-slop]")
        ).length === n,
      THREAD_COMMENTS.length,
      { timeout: 10_000 }
    )
    .then(
      () => true,
      () => false
    )
  check(read, "every comment of a thread without <main> gets marks")
  await thread.close()
}

async function checkLineBreaks(context: BrowserContext) {
  const page = await context.newPage()
  await page.goto(`${PAGES}/breaks`)
  const bars = await page
    .waitForFunction(
      (n) => document.querySelectorAll("slop-marks slop-mark").length === n,
      BREAKS_PARAGRAPHS.length,
      { timeout: 10_000 }
    )
    .then(
      () => true,
      () => false
    )
  check(bars, "paragraphs split only by line breaks each get a mark")

  const aligned = await page.evaluate(() => {
    const left = document.querySelector("font")!.getBoundingClientRect().left
    const lamps = [
      ...document.querySelectorAll<HTMLElement>("slop-marks slop-mark"),
    ]
    const tops = lamps.map((l) => parseFloat(l.style.top))
    const gaps = lamps.map((l) => left + scrollX - parseFloat(l.style.left))
    return {
      beside: gaps.every((gap) => gap > 0 && gap < 40),
      ordered: tops.every((top, i) => i === 0 || top > tops[i - 1]),
    }
  })
  check(aligned.beside, "each lamp sits in the margin beside its own run")
  check(aligned.ordered, "lamps follow the runs down the page")
  await page.close()
}

async function checkSitePolicy(
  context: BrowserContext,
  page: Page,
  worker: Worker
) {
  const markCount = async (p: Page) => Object.keys(await readMarks(p)).length
  const setStorage = (values: Record<string, unknown>) =>
    worker.evaluate((v) => chrome.storage.local.set(v), values)

  await context.route("https://mail.google.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: TEST_PAGE })
  )
  const mail = await context.newPage()
  await mail.goto("https://mail.google.com/mail/u/0/")
  await mail.waitForTimeout(DEFAULT_OFF_WAIT_MS)
  check((await markCount(mail)) === 0, "default off on mail.google.com")

  await setStorage({ sites: { "mail.google.com": true } })
  await mail.waitForSelector("[data-slop]", { timeout: 5000 }).catch(() => null)
  check(
    (await markCount(mail)) > 0,
    "per-site toggle turns it on for mail.google.com"
  )

  await setStorage({ allowlist: true })
  await page.waitForTimeout(SETTLE_MS)
  check(
    (await markCount(page)) === 0 && (await markCount(mail)) > 0,
    "allowlist mode: only allowlisted sites keep running"
  )
  const focusable = await page.evaluate(
    () => document.querySelectorAll("[tabindex]").length
  )
  check(focusable === 0, "turning off removes the tabindex it added")

  await setStorage({ enabled: false })
  await mail.waitForTimeout(SETTLE_MS)
  check((await markCount(mail)) === 0, "global off switch removes all marks")

  await setStorage({ enabled: true, allowlist: false, sites: {} })
  await mail.close()
}

async function checkJank() {
  console.log(
    `\nscroll jank, ${LONG_PAGE_PARAGRAPHS} paragraphs (frame gaps in ms; long tasks > 50 ms):`
  )
  for (const cpuSlowdown of [1, 4]) {
    for (const extensionDir of [null, EXTENSION_DIR]) {
      const report = await measureScroll(extensionDir, cpuSlowdown)
      const name = extensionDir ? "extension" : "baseline "
      console.log(`  cpu ${cpuSlowdown}x ${name}`, JSON.stringify(report))
      if (!extensionDir) continue
      check(
        report.marked >= LONG_PAGE_PARAGRAPHS * MIN_MARKED_SHARE,
        `cpu ${cpuSlowdown}x: ${report.marked}/${LONG_PAGE_PARAGRAPHS} paragraphs marked after one scroll`
      )
    }
  }
}
