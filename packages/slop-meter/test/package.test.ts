import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { score, scoreText, version } from "../src/index.ts"

const MACHINE =
  "In today's fast-paced digital landscape, it's important to note that artificial intelligence plays a pivotal role in shaping the future of work. Moreover, this transformative technology fosters innovation, streamlines workflows, and empowers teams to unlock their full potential. Ultimately, the future looks bright."
const HUMAN =
  "Dad's truck died again on the way to Duluth, so we sat at a Kwik Trip for three hours eating gas station pizza while he argued with the tow guy on the phone. Not the worst Saturday. I finished my book and the kids made friends with a dog named Pickle."
const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url))

const cli = (args: string[], input = "") =>
  spawnSync(process.execPath, [CLI, ...args], { input, encoding: "utf8" })

test("scores a paragraph the way the site does", async () => {
  const machine = await score(MACHINE)
  assert.equal(machine.verdict, "machine")
  assert.equal(machine.label, "machine-ish")
  assert.ok(machine.confidence > 0.9)
  assert.ok(machine.reasons.length > 0)
  const [start, end] = machine.reasons[0].spans[0] ?? [0, 0]
  assert.ok(end > start, "reasons point at the words that set them off")
  const human = await score(HUMAN)
  assert.notEqual(human.verdict, "machine")
  assert.match(version, /^\d{4}-\d{2}-\d{2}/)
})

test("splits text into paragraphs and skips short ones", async () => {
  const readings = await scoreText(`${MACHINE}\n\nToo short.\n\n${HUMAN}`)
  assert.equal(readings.length, 3)
  assert.equal(readings[1].skipped, "too-short")
  assert.equal(readings[1].verdict, "unsure")
})

test("the CLI reads stdin, prints JSON and fails on machine-ish text", () => {
  const json = cli(["--json"], MACHINE)
  assert.equal(json.status, 0)
  const [row] = JSON.parse(json.stdout)
  assert.equal(row.verdict, "machine")
  assert.equal(row.file, "stdin")
  assert.equal(cli(["--fail"], MACHINE).status, 1)
  assert.equal(cli(["--fail"], HUMAN).status, 0)
  const plain = cli([], `# Title\n\n${MACHINE}\n\n\`\`\`\ncode block\n\`\`\``)
  assert.match(plain.stdout, /machine-ish/)
  assert.match(plain.stdout, /1 read · 1 machine-ish/)
})
