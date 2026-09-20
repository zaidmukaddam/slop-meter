import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { type BrowserContext, type Page, chromium } from "playwright-core"
import type { browser } from "wxt/browser"
import { PAGES } from "./servers.ts"

declare const chrome: typeof browser

const VIEWPORT = { width: 1280, height: 800 }
const CARD_TIMEOUT_MS = 3000
const POPUP_SETTLE_MS = 600
const SCROLL_STEP_PX = 40
const LONG_TASK_MS = 50
const SCROLL_TAIL_MS = 1500
const FIRST_MARK_TIMEOUT_MS = 20_000
const NO_EXTENSION_SETTLE_MS = 500

export function launch(extensionDir: string | null): Promise<BrowserContext> {
  const extensionArgs = extensionDir
    ? [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
      ]
    : []
  return chromium.launchPersistentContext("", {
    executablePath: chromePath(),
    headless: true,
    viewport: VIEWPORT,
    args: [...extensionArgs, "--enable-unsafe-webgpu"],
  })
}

function chromePath(): string {
  if (process.env.CHROME) return process.env.CHROME
  const cache = join(homedir(), "Library/Caches/ms-playwright")
  const builds = existsSync(cache)
    ? readdirSync(cache)
        .filter((dir) => /^chromium-\d+$/.test(dir))
        .sort()
        .reverse()
    : []
  const app =
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
  const found = builds
    .map((dir) => join(cache, dir, app))
    .find((path) => existsSync(path))
  return found ?? chromium.executablePath()
}

export function readMarks(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const marked = document.querySelectorAll<HTMLElement>("[data-slop]")
    return Object.fromEntries(
      [...marked].map((el) => [
        el.id,
        `${el.dataset.slop}/${el.dataset.slopConfidence}`,
      ])
    )
  })
}

export function readLayout(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[id]")]
      .map((el) => `${el.id}:${JSON.stringify(el.getBoundingClientRect())}`)
      .join("\n")
  )
}

export async function waitForMarks(page: Page, count: number): Promise<void> {
  await page.waitForFunction(
    (n) => document.querySelectorAll("[data-slop]").length >= n,
    count,
    { timeout: 15_000 }
  )
}

export async function openPopup(
  context: BrowserContext,
  extensionId: string,
  page: Page
): Promise<Page> {
  const worker = context.serviceWorkers()[0]
  await page.bringToFront()
  const tabId = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    })
    return tab.id
  })
  const popup = await context.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`)
  await popup.waitForTimeout(POPUP_SETTLE_MS)
  return popup
}

export async function hoverGutter(page: Page, id: string): Promise<void> {
  const box = await page.locator(`#${id}`).boundingBox()
  if (!box) throw new Error(`#${id} is not rendered`)
  await page.mouse.move(box.x + 200, box.y + 10)
  await page.mouse.move(box.x - 5, box.y + 12, { steps: 4 })
  await cardLocator(page).waitFor({
    state: "visible",
    timeout: CARD_TIMEOUT_MS,
  })
}

export function cardLocator(page: Page) {
  return page.locator("slop-card .card")
}

export function highlightedText(page: Page): Promise<string[] | null> {
  return page.evaluate(() => {
    const highlight = CSS.highlights.get("slop")
    return highlight ? [...highlight].map((range) => range.toString()) : null
  })
}

export type ScrollReport = {
  frames: number
  p50: number
  p95: number
  max: number
  over50: number
  longTasks: number
  longMax: number
  tbt: number
  marked: number
  firstMarkMs: number
}

export async function measureScroll(
  extensionDir: string | null,
  cpuSlowdown: number
): Promise<ScrollReport> {
  const context = await launch(extensionDir)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuSlowdown })

  const started = Date.now()
  await page.goto(`${PAGES}/long`)
  let firstMarkMs = 0
  if (extensionDir) {
    await page.waitForSelector("[data-slop]", {
      timeout: FIRST_MARK_TIMEOUT_MS,
    })
    firstMarkMs = Date.now() - started
  } else {
    await page.waitForTimeout(NO_EXTENSION_SETTLE_MS)
  }
  const report = await page.evaluate(scrollAndMeasure, {
    step: SCROLL_STEP_PX,
    longTaskMs: LONG_TASK_MS,
    tailMs: SCROLL_TAIL_MS,
  })
  await context.close()
  return { ...report, firstMarkMs }
}

async function scrollAndMeasure(options: {
  step: number
  longTaskMs: number
  tailMs: number
}) {
  const longTasks: number[] = []
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration)
  })
  observer.observe({ type: "longtask", buffered: true })

  const gaps: number[] = []
  let last = performance.now()
  await new Promise<void>((done) => {
    const step = () => {
      const now = performance.now()
      gaps.push(now - last)
      last = now
      const bottom = document.documentElement.scrollHeight - 2
      if (scrollY + innerHeight >= bottom) {
        done()
        return
      }
      scrollBy(0, options.step)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  await new Promise((resolve) => setTimeout(resolve, options.tailMs))
  observer.disconnect()

  gaps.shift()
  gaps.sort((a, b) => a - b)
  const quantile = (q: number) => gaps[Math.floor(q * (gaps.length - 1))]
  const round = (value: number, digits: number) => Number(value.toFixed(digits))
  const blocking = longTasks.reduce(
    (sum, duration) => sum + Math.max(0, duration - options.longTaskMs),
    0
  )
  return {
    frames: gaps.length,
    p50: round(quantile(0.5), 1),
    p95: round(quantile(0.95), 1),
    max: round(gaps[gaps.length - 1], 1),
    over50: gaps.filter((gap) => gap > options.longTaskMs).length,
    longTasks: longTasks.length,
    longMax: round(Math.max(0, ...longTasks), 0),
    tbt: round(blocking, 0),
    marked: document.querySelectorAll("[data-slop]").length,
  }
}
