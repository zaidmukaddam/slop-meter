import type { Metadata } from "next"
import { CalibrationRecord } from "@/components/calibration/calibration-record"
import { CorpusTable } from "@/components/calibration/corpus-table"
import { ReliabilityCharts } from "@/components/calibration/reliability-charts"
import { SharperComparison } from "@/components/calibration/sharper-comparison"
import { SourceAccuracy } from "@/components/calibration/source-accuracy"
import { ThresholdExplorer } from "@/components/calibration/threshold-explorer"
import { PageIntro } from "@/components/page-intro"
import { Section } from "@/components/section"
import { REPORT, latestSnapshot } from "@/lib/calibration"
import { decimal, integer, percent } from "@/lib/format"

const TEST_SOURCES = Object.keys(REPORT.model.bySource).filter((key) =>
  key.startsWith("test:")
).length
const web = REPORT.decision.web
const WEB_FIGURES = [
  { value: web.machine + web.mixed, label: "called machine-ish or mixed" },
  { value: web.human, label: "called human-ish" },
  { value: 1 - web.human - web.machine - web.mixed, label: "can't tell" },
]

export const metadata: Metadata = {
  title: "Calibration",
  description: `How often Slop Meter is right, measured on ${integer(REPORT.model.test.n)} held-out paragraphs and on web pages from sites it never trained on, including where it does worst.`,
}

export const revalidate = 3600

export default async function CalibrationPage() {
  const snapshot = await latestSnapshot()
  const test = REPORT.model.test
  const { tau, tauMachine } = REPORT.decision
  const polished = REPORT.model.bySource["test:gateway-polish"].predictedShare

  return (
    <>
      <PageIntro label="Calibration" title="How often it's right">
        <p>
          Measured on {integer(test.n)} held-out paragraphs from {TEST_SOURCES}{" "}
          sources, and on {integer(REPORT.decision.web.n)} paragraphs from web
          pages on sites it never trained on. The numbers include the places it
          does worst.
        </p>
      </PageIntro>

      <CalibrationRecord />

      <Section
        id="web"
        label="Web check"
        title="On pages it never saw"
        lead={`${integer(web.n)} paragraphs from 2019 web pages, on sites kept out of training. People wrote all of them, before chatbots, so any machine-ish or mixed call here is a mistake.`}
      >
        <dl className="grid max-w-2xl gap-6 sm:grid-cols-3">
          {WEB_FIGURES.map((figure) => (
            <div
              key={figure.label}
              className="flex flex-col-reverse justify-end gap-2"
            >
              <dt className="text-sm text-balance text-graphite">
                {figure.label}
              </dt>
              <dd className="font-mono text-3xl font-light tabular-nums">
                {percent(figure.value, 1)}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        id="sharper"
        label="Sharper reading"
        title="What the language model adds"
        lead="Sharper reading is off until you turn it on. Then a small language model, SmolLM2-135M, also reads each paragraph on your device, and a model trained with its numbers makes the call. It's measured on the same held-out test and web check, with bars set the same way."
      >
        <SharperComparison />
      </Section>

      <Section
        id="threshold"
        label="Bars"
        title="Why it says can't tell so often"
        lead={
          <>
            The model always has a top guess. It only shows one when the guess
            clears the bar for that answer, which{" "}
            {tau === tauMachine
              ? `is ${tau} for all three`
              : `is ${tauMachine} for machine-ish and ${tau} for the other two`}
            . The bars are set so its calls are right{" "}
            {percent(REPORT.decision.shipped.accuracyDecided)} of the time on
            held-out text. Move either one to see what a lower bar would cost.
          </>
        }
      >
        <ThresholdExplorer
          curves={REPORT.decision.curves}
          shipped={{
            other: REPORT.decision.tau,
            machine: REPORT.decision.tauMachine,
          }}
        />
      </Section>

      <Section
        id="reliability"
        label="Reliability"
        title="Its odds mean what they say"
        lead="Group paragraphs by the probability the model gave an answer, then count how often that answer was true. A perfectly calibrated model lands on the dashed line."
      >
        <ReliabilityCharts reliability={REPORT.model.reliability} />
        <p className="mt-10 max-w-lg text-[15px]/relaxed text-pretty text-graphite">
          Across is the probability given, up is how often it was true, and
          bigger dots hold more paragraphs. Human-ish and machine-ish stay
          within a few points of the line. Mixed strays furthest, by up to 10
          points in its upper bins, which hold the fewest paragraphs.
        </p>
      </Section>

      <Section
        id="sources"
        label="Sources"
        title="Where it does well, and where it doesn't"
        lead={`The share of paragraphs whose top guess was right, before the bars. Human text polished by a model is the hardest case. It gets called mixed ${percent(polished.mixed)} of the time and machine-ish ${percent(polished.machine)}, which still flags the model's hand, while ${percent(polished.human)} passes as human. Paraphrasing is the attack that hurts most.`}
      >
        <SourceAccuracy />
      </Section>

      <Section
        id="data"
        label="Data"
        title="What it learned from"
        lead="Labels come from where each paragraph came from, not from annotators. Paragraphs from one source document all land in the same split, so the test never sees a version of something from training."
      >
        <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <CorpusTable />
          <dl className="max-w-lg space-y-4 text-[15px]/relaxed text-pretty">
            <div>
              <dt className="legend text-[10px] font-semibold text-human">
                Human
              </dt>
              <dd className="text-graphite">
                RAID's human documents (abstracts, books, news, poetry), Reddit
                posts from 2006 to 2016, Yelp reviews and English Wikipedia.
              </dd>
            </div>
            <div>
              <dt className="legend text-[10px] font-semibold text-machine">
                Machine
              </dt>
              <dd className="text-graphite">
                RAID text from 11 older models, ChatGPT replies to real users
                from WildChat, Llama 3.1 70B answers from Magpie, and paragraphs
                from nine recent models.
              </dd>
            </div>
            <div>
              <dt className="legend text-[10px] font-semibold text-mixed">
                Mixed
              </dt>
              <dd className="text-graphite">
                Human openings finished by a model, and human paragraphs
                polished by one.
              </dd>
            </div>
            <div>
              <dt className="legend text-[10px] font-semibold text-graphite">
                Held-out attacks
              </dt>
              <dd className="text-graphite">
                RAID's paraphrased model text, and text from four models told to
                avoid the tells. None of it was used in training.
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      {snapshot && (
        <Section
          id="readers"
          label="Readers"
          title="What readers' corrections say"
          lead={`${integer(snapshot.n)} corrections shared from the extension for model ${snapshot.model_version}. ${snapshot.ece === null ? "Too few to measure calibration yet." : `The calibration error on them is ${decimal(snapshot.ece)}.`}`}
        >
          <table className="w-full max-w-xl text-sm">
            <caption className="sr-only">
              Corrections and can't-tell rate by week
            </caption>
            <thead>
              <tr className="legend text-[10px] text-graphite">
                <th scope="col" className="py-3 pr-3 text-left font-semibold">
                  Week
                </th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">
                  Corrections
                </th>
                <th scope="col" className="py-3 pl-3 text-right font-semibold">
                  Can't tell
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline border-y border-hairline font-mono tabular-nums">
              {snapshot.unsure_by_week.slice(-8).map((week) => (
                <tr key={week.week}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    {week.week}
                  </th>
                  <td className="px-3 py-2.5 text-right">{integer(week.n)}</td>
                  <td className="py-2.5 pl-3 text-right">
                    {percent(week.unsureRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  )
}
