import base from "@slop/model/manifest.json"
import sharp from "@slop/model/lm/manifest.json"
import type { ModelFacts } from "@/components/bench/model-choice"
import { REPORT, REPORT_LM, type Report } from "./calibration"
import { decimal, integer, percent } from "./format"

/** Both models, as the page talks about them. Every number here comes from the shipped
 *  manifest or the dated report, so a retrain moves the page with it. */
export type ModelId = "standard" | "sharper"

export const MODELS = [
  {
    id: "standard" as const,
    name: "Standard",
    role: "On by default",
    blurb:
      "Measures the text itself: 38 rules, sentence rhythm, word choice. It ships inside the extension and the page, and it reads every paragraph you see.",
    manifest: base,
    report: REPORT as Report,
  },
  {
    id: "sharper" as const,
    name: "Sharper",
    role: "Off until you turn it on",
    blurb:
      "Everything the standard model measures, plus eight numbers from a small language model reading the same paragraph on your machine. It speaks up three times as often, at the cost of a download.",
    manifest: sharp,
    report: REPORT_LM as Report,
  },
]

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`

const answers = (report: Report) =>
  `Answers on ${percent(1 - report.decision.shipped.unsureRate)} of paragraphs, and is right ${percent(report.decision.shipped.accuracyDecided)} of the time when it does.`

/** The lines the bench's model panel shows. Made here, on the server, because the
 *  reports are far too large to ship to the browser for two sentences. */
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

export type Row = { name: string; values: [string, string]; note?: string }
export type Group = { id: string; label: string; rows: Row[] }

const [standard, sharper] = MODELS
const pair = <T>(f: (m: (typeof MODELS)[number]) => T): [T, T] => [
  f(standard),
  f(sharper),
]

export const GROUPS: Group[] = [
  {
    id: "reads",
    label: "What it reads",
    rows: [
      {
        name: "Numbers per paragraph",
        values: pair((m) => integer(m.manifest.features.length)),
        note: "One per rule, the rest stylometry: sentence lengths, word lengths, punctuation, repetition.",
      },
      {
        name: "From a language model",
        values: ["none", integer(sharp.lm.features.length)],
        note: "Surprise, entropy, rank and their spread, measured on the paragraph you are looking at.",
      },
      {
        name: "Shortest paragraph it answers on",
        values: pair((m) => `${m.manifest.minWords} words`),
      },
      {
        name: "Language",
        values: ["English", "English"],
        note: "Anything else is left unmarked rather than guessed at.",
      },
    ],
  },
  {
    id: "costs",
    label: "What it costs you",
    rows: [
      {
        name: "Weights",
        values: pair((m) => kb(m.manifest.bytes)),
        note: "Stored as 8-bit integers, decoded when the model loads.",
      },
      {
        name: "Numbers in the model",
        values: pair((m) => integer(m.manifest.params)),
      },
      {
        name: "Extra download",
        values: ["none", "about 125 MB, once"],
        note: "SmolLM2-135M in 4-bit, from Hugging Face, cached by the browser after the first run.",
      },
      {
        name: "Memory while reading",
        values: ["a few megabytes", "about 800 MB"],
      },
      {
        name: "Needs",
        values: ["any current browser", "WebGPU with 16-bit floats"],
        note: "The standard model uses WebGPU when the browser has it and falls back to the CPU when it doesn't.",
      },
      {
        name: "How much of a paragraph it reads",
        values: ["all of it", `first ${sharp.lm.maxTokens} tokens`],
        note: "The cap bounds memory on a page of long paragraphs. Paragraphs run 60 tokens at the median and 220 at the 99th, so it bites on 0.6% of them, and those are still read four fifths of the way through.",
      },
    ],
  },
  {
    id: "says",
    label: "What it says",
    rows: [
      {
        name: "Says can't tell",
        values: pair((m) => percent(m.report.decision.shipped.unsureRate, 1)),
        note: "On held-out paragraphs, at the shipped bars.",
      },
      {
        name: "Right when it makes a call",
        values: pair((m) =>
          percent(m.report.decision.shipped.accuracyDecided, 1)
        ),
      },
      {
        name: "Human text called machine-ish",
        values: pair((m) =>
          percent(m.report.decision.shipped.falseMachineRateOnHuman, 2)
        ),
      },
      {
        name: "Web pages called machine-ish",
        values: pair((m) => percent(m.report.decision.web.machine, 2)),
        note: "Paragraphs from 2019 web pages, on sites kept out of training. People wrote all of them, so every call here is a mistake.",
      },
      {
        name: "Web pages called human-ish",
        values: pair((m) => percent(m.report.decision.web.human, 1)),
      },
      {
        name: "Bar for machine-ish, for the others",
        values: pair((m) => `${m.manifest.tauMachine} · ${m.manifest.tau}`),
        note: "Both bars are set for the same thing: right about 96 times in 100 when it speaks.",
      },
      {
        name: "Calibration error",
        values: pair((m) => decimal(m.report.model.test.ece)),
        note: "How far its stated odds sit from how often it is actually right. Lower is better.",
      },
      {
        name: "Telling machine from human",
        values: pair((m) =>
          decimal(m.report.model.test.aurocMachineVsHuman, 2)
        ),
        note: "Area under the ROC curve, before any bar: 0.5 is a coin, 1 is perfect.",
      },
    ],
  },
  {
    id: "built",
    label: "How it was built",
    rows: [
      { name: "Shape", values: pair((m) => m.report.model.arch) },
      {
        name: "Runs trained, run shipped",
        values: pair(
          (m) => `${m.report.model.seeds.length}, seed ${m.report.model.seed}`
        ),
        note: "Each run is a different starting point. The one shipped is the one that called the fewest human paragraphs machine-ish on validation.",
      },
      {
        name: "Training time",
        values: pair((m) => `${Math.round(m.report.model.trainSeconds)} s`),
      },
      {
        name: "Version",
        values: pair((m) => m.manifest.version),
      },
      {
        name: "Feature spec",
        values: pair((m) => integer(m.manifest.spec)),
        note: "The frozen list of measurements. Weights only load against the spec they were trained on.",
      },
    ],
  },
]

export const LM_FEATURES = [
  {
    id: "lm:logp",
    name: "Surprise",
    what: "The mean log probability the language model gave the words that were actually written. Text a model wrote is text that model finds likely.",
  },
  {
    id: "lm:entropy",
    name: "Choices",
    what: "How spread out the next-word guesses were at each step. A wide field means the writing could have gone many ways.",
  },
  {
    id: "lm:fastdetect",
    name: "Curvature",
    what: "How far the written word sits from the average word the model expected there, counted in standard deviations. This is the FastDetectGPT statistic.",
  },
  {
    id: "lm:binoculars",
    name: "Surprise against choices",
    what: "Surprise divided by how open the choice was, so an ordinary word in a wide-open spot doesn't read the same as an ordinary word in a forced one.",
  },
  {
    id: "lm:logrank",
    name: "Rank",
    what: "Where the written word placed among all the candidates, averaged over the paragraph.",
  },
  {
    id: "lm:top1",
    name: "First choice",
    what: "The share of words that were the language model's own first pick.",
  },
  {
    id: "lm:top10",
    name: "Top ten",
    what: "The share that were somewhere in its first ten.",
  },
  {
    id: "lm:surprisal-std",
    name: "Spread of surprise",
    what: "How much surprise varies across the paragraph. People spike and dip; generated text tends to hold an even level.",
  },
]
