import type { Metadata } from "next"
import Link from "next/link"
import { ReliabilityCharts } from "@/components/calibration/reliability-charts"
import { Benchmark } from "@/components/models/benchmark"
import { Compare } from "@/components/models/compare"
import { FlagField } from "@/components/models/flag-field"
import { PageIntro } from "@/components/page-intro"
import { Section } from "@/components/section"
import { REPORT } from "@/lib/calibration"
import { integer } from "@/lib/format"
import { loadDemo } from "@/lib/models-demo"

const SURE = Math.round(REPORT.decision.tauMachine * 100)

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
