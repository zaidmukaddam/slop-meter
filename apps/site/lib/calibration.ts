import report from "@slop/eval/report.json"
import reportLm from "@slop/eval/report-lm.json"
import type { Reliability, WeekRate } from "./server/calibrate"
import { sql } from "./server/db"

export type Report = typeof report | typeof reportLm
export const REPORT: Report = report
export const REPORT_LM: Report = reportLm

export type Snapshot = {
  created_at: string
  model_version: string
  n: number
  ece: number | null
  bins: Reliability
  unsure_by_week: WeekRate[]
}

export async function latestSnapshot(): Promise<Snapshot | null> {
  if (!sql) return null
  try {
    const rows = await sql`
      select created_at, model_version, n, ece, bins, unsure_by_week
      from calibration_snapshots
      order by id desc
      limit 1`
    return (rows[0] as Snapshot | undefined) ?? null
  } catch {
    return null
  }
}

export type SourceKind = "human" | "machine" | "mixed" | "both"

export const SOURCES: Record<string, { name: string; kind: SourceKind }> = {
  "test:magpie": { name: "Llama 3.1 70B answers (Magpie)", kind: "machine" },
  "test:reddit": { name: "Reddit posts, 2006 to 2016", kind: "human" },
  "test:wildchat": {
    name: "ChatGPT replies to real users (WildChat)",
    kind: "machine",
  },
  "test:raid": {
    name: "RAID: human documents and 11 older models",
    kind: "both",
  },
  "test:yelp": { name: "Yelp reviews", kind: "human" },
  "test:gateway-plain": {
    name: "Recent models, plain prompts",
    kind: "machine",
  },
  "test:raid-splice": {
    name: "Human openings finished by a model",
    kind: "mixed",
  },
  "test:gateway-antitell": {
    name: "Recent models told to avoid the tells",
    kind: "machine",
  },
  "test:wikipedia": { name: "English Wikipedia", kind: "human" },
  "test:c4": { name: "Web pages, 2019 (C4)", kind: "human" },
  "test:gateway-polish": {
    name: "Human paragraphs polished by a model",
    kind: "mixed",
  },
  "adv:gateway-antitell": {
    name: "Held-out models told to avoid the tells",
    kind: "machine",
  },
  "adv:raid-paraphrase": {
    name: "RAID model text, paraphrased",
    kind: "machine",
  },
  "web:c4": {
    name: "Web pages, 2019, from sites kept out of training",
    kind: "human",
  },
}
