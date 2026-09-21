import { type Reason, type Score, Scorer, explain } from "@slop/model"
import manifest from "@slop/model/manifest.json"
import { tellSpans } from "@slop/rules/names"
import { weights } from "../models-demo"

const TEXT =
  "In today's fast-paced digital landscape, it's important to note that artificial intelligence plays a pivotal role in shaping the future of work. Moreover, this transformative technology fosters innovation, streamlines workflows, and empowers teams to unlock their full potential. Ultimately, the future looks bright."

export type Cover = {
  pieces: { text: string; marked: boolean }[]
  score: Score
  reasons: Reason[]
}

export async function loadCover(): Promise<Cover> {
  const scorer = await Scorer.create(manifest, weights("model.bin"), {
    backend: "cpu",
  })
  const score = scorer.score(TEXT)
  const reasons = explain(score)
  const spans = reasons
    .flatMap(tellSpans)
    .sort((a, b) => a[0] - b[0])
    .reduce<[number, number][]>((merged, [start, end]) => {
      const last = merged.at(-1)
      if (last && start <= last[1]) last[1] = Math.max(last[1], end)
      else merged.push([start, end])
      return merged
    }, [])
  const pieces: Cover["pieces"] = []
  let from = 0
  for (const [start, end] of spans) {
    if (start > from) {
      pieces.push({ text: TEXT.slice(from, start), marked: false })
    }
    pieces.push({ text: TEXT.slice(start, end), marked: true })
    from = end
  }
  pieces.push({ text: TEXT.slice(from), marked: false })
  return { pieces, score, reasons }
}
