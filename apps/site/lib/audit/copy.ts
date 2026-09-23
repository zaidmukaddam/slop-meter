import { Scorer, isRead } from "@slop/model"
import manifest from "@slop/model/manifest.json"
import { weights } from "@/lib/models-demo"
import { type Finding, paragraphs } from "./checks"

const MAX_PARAGRAPHS = 60
const SHARE = 0.2
const MIN_PARAGRAPHS = 5

let scorer: Promise<Scorer> | null = null

export async function copyFinding(html: string): Promise<Finding> {
  scorer ??= Scorer.create(manifest, weights("model.bin"), { backend: "cpu" })
  const model = await scorer
  const read = paragraphs(html)
    .slice(0, MAX_PARAGRAPHS)
    .map((p) => model.score(p))
    .filter(isRead)
  const machine = read.filter((s) => s.localDecision === "machine").length
  const hit = read.length >= MIN_PARAGRAPHS && machine / read.length >= SHARE
  return {
    id: "machine-copy",
    group: "Copy",
    title: "Copy that reads machine-written",
    hit,
    evidence: read.length
      ? `Slop Meter calls ${machine} of ${read.length} paragraphs machine-ish`
      : "not enough paragraphs to read",
  }
}
