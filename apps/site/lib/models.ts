import base from "@slop/model/manifest.json"
import sharp from "@slop/model/lm/manifest.json"
import type { ModelFacts } from "@/components/bench/model-choice"
import { REPORT, REPORT_LM, type Report } from "./calibration"
import { integer, percent } from "./format"

export type ModelId = "standard" | "sharper"

export const MODELS = [
  {
    id: "standard" as const,
    name: "Standard",
    role: "On by default",
    manifest: base,
    report: REPORT as Report,
  },
  {
    id: "sharper" as const,
    name: "Sharper",
    role: "Off by default",
    manifest: sharp,
    report: REPORT_LM as Report,
  },
]

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`

const answers = (report: Report) =>
  `Answers on ${percent(1 - report.decision.shipped.unsureRate)} of paragraphs, and is right ${percent(report.decision.shipped.accuracyDecided)} of the time when it does.`

export const MODEL_FACTS: ModelFacts = {
  standard: {
    spec: `${kb(base.bytes)} · ${integer(base.features.length)} numbers a paragraph`,
    short: `${kb(base.bytes)} · ${integer(base.features.length)} numbers`,
    note: answers(REPORT),
  },
  sharper: {
    spec: `+ SmolLM2-135M · ${integer(sharp.features.length)} numbers a paragraph`,
    short: `+ 135M LM · ${integer(sharp.features.length)} numbers`,
    note: answers(REPORT_LM),
  },
}

const [standard, sharper] = MODELS
const pair = <T>(f: (m: (typeof MODELS)[number]) => T): [T, T] => [
  f(standard),
  f(sharper),
]

const verdicts = (m: (typeof MODELS)[number]) =>
  1 - m.report.decision.shipped.unsureRate

export const VERDICT_RATIO = verdicts(sharper) / verdicts(standard)

export type Cell = { value: string; note?: string }
export type Spec = {
  title: string
  rows: { label: string; cells: [Cell, Cell] }[]
}

export const SPECS: Spec[] = [
  {
    title: "Summary",
    rows: [
      {
        label: "Gives a verdict",
        cells: [
          { value: "1×", note: "When the writing makes it clear." },
          {
            value: `${VERDICT_RATIO.toFixed(1)}×`,
            note: "As often as Standard, on the same text.",
          },
        ],
      },
      {
        label: "Right when it does",
        cells: pair((m) => ({
          value: percent(m.report.decision.shipped.accuracyDecided, 1),
        })),
      },
      {
        label: "People's writing called machine-ish",
        cells: pair((m) => ({
          value: `${Math.round(m.report.decision.shipped.falseMachineRateOnHuman * 1000)} in 1,000`,
          note: "paragraphs",
        })),
      },
    ],
  },
  {
    title: "What it takes",
    rows: [
      {
        label: "Download",
        cells: [
          { value: "—", note: "It comes with the page." },
          { value: "125 MB", note: "Once, then kept in the browser." },
        ],
      },
      {
        label: "Memory while reading",
        cells: [{ value: "A few MB" }, { value: "About 600 MB" }],
      },
      {
        label: "Works in",
        cells: [
          { value: "Any browser", note: "Phones included." },
          {
            value: "Chrome, Edge, Safari",
            note: "Recent versions. Can be too heavy for a phone.",
          },
        ],
      },
    ],
  },
  {
    title: "Best for",
    rows: [
      {
        label: "Use it for",
        cells: [
          { value: "Everything", note: "It's already on." },
          {
            value: "One close read",
            note: "When Standard keeps saying can't tell.",
          },
        ],
      },
    ],
  },
]
