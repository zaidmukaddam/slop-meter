import { execSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { createServer } from "node:http"
import { join } from "node:path"
import { hoverGutter, launch, openPopup, waitForMarks } from "./browser.ts"
import { MACHINE } from "./fixtures.ts"

const PACKAGE_DIR = join(import.meta.dirname, "..")
const EXTENSION_DIR = join(PACKAGE_DIR, ".output/chrome-mv3")
const OUT = join(PACKAGE_DIR, ".output/store")
const PORT = 4173
const HOST = "marginalia.example"
const API = "https://slop-meter.com"

const GRAHAME =
  "The Mole had been working very hard all the morning, spring-cleaning his little home. First with brooms, then with dusters; then on ladders and steps and chairs, with a brush and a pail of whitewash; till he had dust in his throat and eyes, and splashes of whitewash all over his black fur, and an aching back and weary arms. Spring was moving in the air above and in the earth below and around him, penetrating even his dark and lowly little house with its spirit of divine discontent and longing."
const TWAIN =
  "When I was a boy, there was but one permanent ambition among my comrades in our village on the west bank of the Mississippi River. That was, to be a steamboatman. We had transient ambitions of other sorts, but they were only transient. When a circus came and went, it left us all burning to become clowns; the first negro minstrel show that came to our section left us all suffering to try that kind of life; now and then we had a hope that if we lived and were good, God would permit us to be pirates."

const BLOCKS = [
  ["From a company blog", "machine-1", MACHINE[0]],
  ["From The Wind in the Willows, 1908", "human-1", GRAHAME],
  ["From a travel page", "machine-2", MACHINE[1]],
  ["From Life on the Mississippi, 1883", "human-2", TWAIN],
]

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Four paragraphs</title>
<style>
  body { margin: 0; background: #fbfaf7; color: #1b1a17; font: 19px/1.65 Georgia, serif; }
  header { border-bottom: 1px solid #e4e1d8; padding: 18px 0; font: 600 13px/1 system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
  header div, main { width: 680px; margin: 0 auto; }
  h1 { font-size: 40px; line-height: 1.15; margin: 44px 0 8px; }
  h2 { font: 600 12px/1 system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #77736a; margin: 34px 0 10px; }
  p { margin: 0; }
</style>
</head>
<body>
<header><div>Marginalia</div></header>
<main>
<h1>Four paragraphs, read closely</h1>
${BLOCKS.map(([heading, id, text]) => `<h2>${heading}</h2>\n<p id="${id}">${text}</p>`).join("\n")}
</main>
</body>
</html>`

execSync("pnpm wxt build", {
  cwd: PACKAGE_DIR,
  env: { ...process.env, WXT_API_BASE: API },
  stdio: "ignore",
})
mkdirSync(OUT, { recursive: true })

const server = createServer((_, response) => {
  response.setHeader("content-type", "text/html")
  response.end(PAGE)
})
await new Promise<void>((resolve) => server.listen(PORT, resolve))

const context = await launch(EXTENSION_DIR, [
  `--host-resolver-rules=MAP ${HOST} 127.0.0.1`,
])
const worker =
  context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
const extensionId = new URL(worker.url()).host
const page = await context.newPage()
await page.goto(`http://${HOST}:${PORT}/`)
await waitForMarks(page, BLOCKS.length)

const shoot = (name: string, target = page) =>
  target.screenshot({ path: join(OUT, `${name}.png`) })

await hoverGutter(page, "machine-1")
await page.waitForTimeout(400)
await shoot("1-machine-ish")

await page.mouse.move(1100, 700)
await page.keyboard.press("Escape")
await page.waitForTimeout(300)
await hoverGutter(page, "human-1")
await page.waitForTimeout(400)
await shoot("2-human-ish")

const popup = await openPopup(context, extensionId, page)
await popup.addStyleTag({
  content:
    "html { background: #2a2926; } body { margin: 24px auto !important; border-radius: 12px; box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.35), 0 0 0 1px rgb(0 0 0 / 0.08); overflow: hidden; }",
})
await popup.waitForTimeout(300)
await shoot("3-popup", popup)

await context.close()
server.close()
console.log(`store screenshots: ${OUT}`)
