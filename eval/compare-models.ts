/**
 * Judges two shipped models on the same paragraphs: the held-out test split, the
 * adversarial split and the web check, straight from training/data/corpus.jsonl.
 *
 *   node compare-models.ts <dir-a> <dir-b>
 *
 * A directory is any folder holding manifest.json and model.bin. Nothing here reads
 * eval/report.json, so two models trained on different corpora can still be compared,
 * as long as the corpus on disk is the one you want to judge them on.
 */
import { readFileSync } from "node:fs"
import { type Score, Scorer, isRead } from "@slop/model"

type Row = { text: string; label: string; split: string; source: string }

const here = (path: string) => new URL(path, import.meta.url)

const rows = readFileSync(here("../training/data/corpus.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line, index) => ({ ...(JSON.parse(line) as Row), index }))

/** A sharper model needs the language model's numbers for the same row, which
 *  featurize-lm.ts wrote in corpus order. */
const lmFeatures = (() => {
  try {
    const raw = readFileSync(here("../training/data/lm.f32"))
    const spec = JSON.parse(
      readFileSync(here("../training/data/lm.json"), "utf8")
    )
    const width = spec.features.length
    const all = new Float32Array(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
    )
    return (index: number) => all.subarray(index * width, index * width + width)
  } catch {
    return null
  }
})()

const bytes = (path: string) => {
  const bin = readFileSync(path)
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
}

async function load(dir: string) {
  const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"))
  if (!manifest.lm) {
    return {
      scorer: await Scorer.create(manifest, bytes(`${dir}/model.bin`), {
        backend: "cpu",
      }),
      sharp: false,
    }
  }
  const base = JSON.parse(
    readFileSync(here("../packages/model/weights/manifest.json"), "utf8")
  )
  const scorer = await Scorer.create(
    base,
    bytes(
      String(here("../packages/model/weights/model.bin")).replace("file://", "")
    ),
    { backend: "cpu" }
  )
  scorer.useLm(manifest, bytes(`${dir}/model.bin`))
  if (!lmFeatures)
    throw new Error("no training/data/lm.f32 for a sharper model")
  return { scorer, sharp: true }
}

type Judged = { row: Row & { index: number }; score: Score }
type Loaded = { scorer: Scorer; sharp: boolean }

const share = (items: Judged[], of: (j: Judged) => boolean) =>
  items.length ? items.filter(of).length / items.length : 0

function judge({ scorer, sharp }: Loaded, dir: string) {
  const on = (split: string): Judged[] =>
    rows
      .filter((r) => r.split === split)
      .map((row) => ({
        row,
        score: scorer.score(
          row.text,
          sharp && lmFeatures ? lmFeatures(row.index) : undefined
        ),
      }))
      .filter((j) => isRead(j.score))

  const test = on("test")
  const called = test.filter((s) => s.score.localDecision !== "unsure")
  const humanText = test.filter((s) => s.row.label === "human")
  const machineText = test.filter((s) => s.row.label === "machine")
  const web = on("web")
  const adv = on("adv")

  return {
    model: dir.split("/").slice(-2).join("/"),
    "can't tell": share(test, (j) => j.score.localDecision === "unsure"),
    "right on calls": share(
      called,
      (j) => j.score.localDecision === j.row.label
    ),
    "human called machine": share(
      humanText,
      (j) => j.score.localDecision === "machine"
    ),
    "machine caught": share(
      machineText,
      (j) => j.score.localDecision === "machine"
    ),
    // The machine text people actually meet. Catching more 2023-era RAID output is
    // no consolation for catching less of this.
    "current models caught": share(
      machineText.filter((j) => j.row.source === "gateway-plain"),
      (j) => j.score.localDecision === "machine"
    ),
    "web called machine": share(
      web,
      (j) => j.score.localDecision === "machine"
    ),
    "web called human": share(web, (j) => j.score.localDecision === "human"),
    "adversarial caught": share(
      adv,
      (j) => j.score.localDecision === "machine"
    ),
  }
}

const dirs = process.argv.slice(2)
if (dirs.length < 2) throw new Error("give two model directories")
const table = []
for (const dir of dirs) table.push(judge(await load(dir), dir))

const pct = (x: number) => `${(100 * x).toFixed(2)}%`
console.table(
  table.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? pct(v) : v])
    )
  )
)

// No regression means: never worse on a call it shouldn't make, better somewhere.
const [before, after] = table
const worse = [
  ["human called machine", 1],
  ["web called machine", 1],
  ["right on calls", -1],
  ["machine caught", -1],
  ["current models caught", -1],
] as const
for (const [key, sign] of worse) {
  const delta = (after[key] as number) - (before[key] as number)
  if (delta * sign > 1e-9) {
    console.log(
      `REGRESSION on ${key}: ${pct(before[key] as number)} to ${pct(after[key] as number)}`
    )
  }
}
