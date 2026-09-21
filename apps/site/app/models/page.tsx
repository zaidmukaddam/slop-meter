import sharperManifest from "@slop/model/lm/manifest.json"
import type { Metadata } from "next"
import Link from "next/link"
import { ReliabilityCharts } from "@/components/calibration/reliability-charts"
import {
  SharperPipeline,
  StandardPipeline,
} from "@/components/models/architecture"
import { Benchmark } from "@/components/models/benchmark"
import { Compare } from "@/components/models/compare"
import { FlagField } from "@/components/models/flag-field"
import { PageIntro } from "@/components/page-intro"
import { Section } from "@/components/section"
import { REPORT } from "@/lib/calibration"
import { integer } from "@/lib/format"
import { MODELS } from "@/lib/models"
import { loadDemo } from "@/lib/models-demo"
import { cn } from "@/lib/utils"

const SURE = Math.round(REPORT.decision.tauMachine * 100)

const [standard, sharper] = MODELS
const train = REPORT.corpus.train
const { lm } = sharperManifest

const BUILD = [
  {
    title: "What it learned from",
    body: `${integer(train.human + train.machine + train.mixed)} paragraphs: ${integer(train.human)} by people, ${integer(train.machine)} by models and ${integer(train.mixed)} by both. Another ${integer(REPORT.model.test.n)} were held back for testing and never trained on.`,
  },
  {
    title: `${REPORT.model.seeds.length} runs, one ships`,
    body: "Each retrain fits the network from several starting points, a few minutes in all. The run that catches the most text from current models ships, as long as it flags at most 1 person's paragraph in 1,000.",
  },
  {
    title: "Small enough to go anywhere",
    body: `The ${integer(standard.manifest.params)} weights are rounded to 8-bit integers, which is how the model fits in ${Math.round(standard.manifest.bytes / 1024)} KB. Rounding moves no probability by more than ${REPORT.quantization.maxAbsProbDelta.toFixed(2)}.`,
  },
  {
    title: "Fast enough to read as you scroll",
    body: `Measuring a paragraph takes about ${REPORT.featureMsPerParagraph.toFixed(2)} ms. The network is a page of TypeScript, with a WGSL shader doing the same sums on WebGPU where the browser has it.`,
  },
]

const BUILD_SHARPER = [
  {
    title: `The ${lm.features.length} numbers`,
    body: "How surprising it found the words, how open each choice was, where each word ranked, how often the word was its first pick or in its top ten, and how much surprise varies across the paragraph. Two more are the statistics from the Fast-DetectGPT and Binoculars papers.",
  },
  {
    title: "Why it helps",
    body: "Text a model wrote is text a language model finds unsurprising. Standard can't see that, because it only counts things. With it, the same network is sure about more than twice as many paragraphs.",
  },
  {
    title: "Kept off the CPU",
    body: `The language model's raw output is 49,152 numbers for every word. A shader reduces that on the GPU, so only 16 bytes a word come back. It took the memory Sharper holds in Safari from about 2 GB to under 600 MB.`,
  },
]

const LIMITS = [
  {
    title: "Rewritten machine text gets through",
    body: "Run a model's text through a paraphraser and it catches fewer than 1 paragraph in 10.",
  },
  {
    title: "A person's draft polished by a model",
    body: "About half of it still reads as human. The rest leans mixed or machine-ish.",
  },
  {
    title: "The newest models are harder",
    body: "Their writing is closer to a person's, so more of it gets can't tell.",
  },
  {
    title: "English only",
    body: "Anything else is left unmarked, not guessed at.",
  },
]

export const metadata: Metadata = {
  title: "Models",
  alternates: { canonical: "/models" },
  description:
    "Standard and Sharper side by side: how each one reads, how often it gives a verdict, how often it's right, and what it costs to run.",
}

function Notes({ items }: { items: { title: string; body: string }[] }) {
  return (
    <dl
      className={cn(
        "mt-16 grid gap-x-12 gap-y-10 sm:grid-cols-2",
        items.length === 4 ? "lg:grid-cols-4" : "max-w-5xl lg:grid-cols-3"
      )}
    >
      {items.map((item) => (
        <div key={item.title}>
          <dt className="font-semibold text-pretty">{item.title}</dt>
          <dd className="mt-2 max-w-sm text-[15px]/relaxed text-pretty text-graphite">
            {item.body}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default async function ModelsPage() {
  const demo = await loadDemo()
  return (
    <>
      <PageIntro label="Models" title="Slop Meter models">
        <p>
          Standard reads every page you open, as fast as you can scroll. Sharper
          adds a small language model for the paragraphs Standard can&apos;t
          call. Both run on your device.
        </p>
      </PageIntro>

      <Section
        id="standard"
        label="Standard · on by default"
        title="A small network that never sees your words"
        lead={`A paragraph is turned into ${standard.manifest.features.length} numbers first, and only the numbers go into the model. That is why it fits in ${Math.round(standard.manifest.bytes / 1024)} KB and ships inside the page.`}
      >
        <StandardPipeline />
        <Notes items={BUILD} />
      </Section>

      <Section
        id="sharper"
        label="Sharper · off by default"
        title="The same network, with a language model's opinion"
        lead="Sharper runs a small language model over the paragraph, on your device, and hands what it learns to a slightly wider network."
      >
        <SharperPipeline />
        <Notes items={BUILD_SHARPER} />
      </Section>

      <Compare demo={demo} />

      <Section
        id="benchmark"
        label="Benchmark"
        title="Against an AI judge that always answers"
        lead="We gave the same paragraphs to Standard, Sharper and Jev, a hosted model built to judge things. The orange is what each one got wrong."
      >
        <Benchmark />
      </Section>

      <Section
        id="careful"
        label="Why it holds back"
        title="Calling a person a machine is the worst mistake"
        lead={`So it stays quiet until it is ${SURE}% sure. Drag the setting down and it would speak up more, and accuse more people. These are Standard's numbers.`}
      >
        <FlagField
          curve={REPORT.decision.curves.machine}
          shipped={REPORT.decision.tauMachine}
        />
      </Section>

      <Section
        id="odds"
        label="The percentages"
        title="When it says 90%, it is right about 90% of the time"
        lead="Every verdict comes with a percentage. We grouped paragraphs by the percentage it gave, then checked how often it was right. Dots on the dashed line mean the number can be trusted."
      >
        <ReliabilityCharts reliability={REPORT.model.reliability} />
      </Section>

      <Section
        id="limits"
        label="Good to know"
        title="Where it struggles"
        lead="A mark is a guess about style. It can't tell you who wrote something."
      >
        <dl className="grid max-w-4xl gap-x-16 gap-y-8 sm:grid-cols-2">
          {LIMITS.map((limit) => (
            <div key={limit.title}>
              <dt className="font-semibold text-pretty">{limit.title}</dt>
              <dd className="mt-2 max-w-sm text-[15px]/relaxed text-pretty text-graphite">
                {limit.body}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <footer className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-8">
          <p className="max-w-2xl text-sm/relaxed text-pretty text-graphite">
            Both run in your browser, so nothing you read or paste is uploaded.
            The numbers were measured on {integer(REPORT.model.test.n)}{" "}
            paragraphs neither model saw in training, on {REPORT.date}. The{" "}
            <Link href="/rules" className="underline">
              rulebook
            </Link>{" "}
            lists the habits they look for, and the{" "}
            <Link href="/changelog" className="underline">
              changelog
            </Link>{" "}
            has every retrain.
          </p>
        </div>
      </footer>
    </>
  )
}
