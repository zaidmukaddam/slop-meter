import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"
import type { Reading } from "../types/index.d.ts"
import { scoreText, version } from "./index.ts"

const HELP = `Usage: slop-meter [options] [file ...]

Marks each paragraph human-ish, machine-ish, mixed or can't tell.
Reads the files you name, or standard input when you name none.
Everything runs on this machine. No text is sent anywhere.

Options:
  --json     Print every paragraph as JSON
  --why      List the rules behind each call
  --fail     Exit with code 1 if any paragraph is machine-ish
  -v         Print the version
  -h         Print this help`

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code: number, s: string) =>
  COLOR ? `\x1b[${code}m${s}\x1b[0m` : s
const TONE = { machine: 33, human: 34, mixed: 35, unsure: 2 } as const

function prose(text: string): string {
  return text
    .replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^#{1,6}\s.*$/gm, "")
}

function line(r: Reading, n: number, width: number): string {
  const percent =
    r.verdict === "unsure"
      ? "    "
      : `${Math.round(r.confidence * 100)}%`.padStart(4)
  const head = `  ¶${String(n).padEnd(3)} ${r.label.padEnd(11)} ${percent}  `
  const room = Math.max(20, width - head.length)
  const text = r.text.replace(/\s+/g, " ")
  const clipped = text.length > room ? `${text.slice(0, room - 1)}…` : text
  return paint(TONE[r.verdict], head) + paint(2, clipped)
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: "boolean" },
      why: { type: "boolean" },
      fail: { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  })
  if (values.help) return console.log(HELP)
  if (values.version) return console.log(`slop-meter model ${version}`)
  if (!positionals.length && process.stdin.isTTY) {
    console.log(HELP)
    process.exitCode = 2
    return
  }

  const sources = positionals.length
    ? positionals.map((file) => ({ file, text: readFileSync(file, "utf8") }))
    : [{ file: "stdin", text: readFileSync(0, "utf8") }]

  const width = process.stdout.columns || 100
  const all: (Reading & { file: string; paragraph: number })[] = []
  for (const { file, text } of sources) {
    const readings = await scoreText(prose(text))
    readings.forEach((r, i) => all.push({ ...r, file, paragraph: i + 1 }))
    if (values.json) continue
    const read = readings
      .map((r, i) => ({ r, n: i + 1 }))
      .filter(({ r }) => !r.skipped)
    console.log(paint(1, file))
    for (const { r, n } of read) {
      console.log(line(r, n, width))
      if (values.why && r.verdict !== "unsure" && r.reasons.length) {
        console.log(
          paint(2, `         ${r.reasons.map((x) => x.name).join(", ")}`)
        )
      }
    }
    const count = (v: Reading["verdict"]) =>
      read.filter(({ r }) => r.verdict === v).length
    const skipped = readings.length - read.length
    console.log(
      paint(
        2,
        `  ${read.length} read · ${count("machine")} machine-ish · ${count("human")} human-ish · ${count("mixed")} mixed · ${count("unsure")} can't tell` +
          (skipped ? ` · ${skipped} too short or not English` : "")
      ) + "\n"
    )
  }
  if (values.json) console.log(JSON.stringify(all, null, 2))
  if (values.fail && all.some((r) => r.verdict === "machine")) {
    process.exitCode = 1
  }
}

main().catch((error: Error) => {
  console.error(`slop-meter: ${error.message}`)
  process.exitCode = 2
})
