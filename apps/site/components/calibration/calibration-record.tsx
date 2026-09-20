import manifest from "@slop/model/manifest.json"
import { REPORT } from "@/lib/calibration"
import { decimal, integer, percent } from "@/lib/format"

const test = REPORT.model.test
const baseline = REPORT.baseline
const shipped = REPORT.decision.shipped

const HEADER = [
  `Model ${manifest.version}`,
  `tested ${REPORT.date}`,
  `${integer(test.n)} held-out paragraphs`,
  manifest.tau === manifest.tauMachine
    ? `bar ${manifest.tau}`
    : `bars ${manifest.tau}, machine-ish ${manifest.tauMachine}`,
]

const FIGURES = [
  {
    value: percent(shipped.accuracyDecided, 1),
    label: "right when it makes a call",
  },
  { value: percent(shipped.unsureRate), label: "of paragraphs get can't tell" },
  {
    value: percent(shipped.falseMachineRateOnHuman, 1),
    label: "of human paragraphs called machine-ish",
  },
]

type TestPoint = {
  name: string
  measured: string
  required?: string
  passed?: boolean
}

const TEST_POINTS: TestPoint[] = [
  {
    name: "Calibration error (ECE)",
    measured: decimal(test.ece),
    required: `${REPORT.eceTarget} or less`,
    passed: REPORT.m2Exit.calibrated,
  },
  {
    name: "Top guess right, test set",
    measured: percent(test.accuracy, 1),
    required: `beat rules alone, ${percent(baseline.test.accuracy, 1)}`,
    passed: REPORT.m2Exit.beatsBaselineOnTest,
  },
  {
    name: "Top guess right, held-out attacks",
    measured: percent(REPORT.model.adv.accuracy, 1),
    required: `beat rules alone, ${percent(baseline.adv.accuracy, 1)}`,
    passed: REPORT.m2Exit.beatsBaselineOnAdversarial,
  },
  {
    name: "Separates machine from human (AUROC)",
    measured: decimal(test.aurocMachineVsHuman),
  },
  {
    name: "Machine text, top guess machine-ish",
    measured: percent(test.machineRecall, 1),
  },
  {
    name: "Human text, top guess machine-ish",
    measured: percent(test.falseMachineRateOnHuman, 1),
  },
  {
    name: "Web pages from sites kept out of training, top guess machine-ish",
    measured: percent(
      REPORT.model.bySource["web:c4"].predictedShare.machine,
      1
    ),
  },
  {
    name: "Largest probability change from 8-bit weights",
    measured: decimal(REPORT.quantization.maxAbsProbDelta),
  },
]

export function CalibrationRecord() {
  return (
    <section
      aria-labelledby="record-title"
      className="mx-auto w-full max-w-[1200px] px-5 pb-20 sm:px-8 sm:pb-24"
    >
      <div className="relative isolate -mx-5 overflow-hidden border-y border-hairline bg-sheet sm:mx-0 sm:rounded-md sm:border-x">
        <div
          aria-hidden
          className="paper-grain pointer-events-none absolute inset-0 -z-10"
        />
        <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-hairline px-5 py-5 sm:px-10">
          <h2
            id="record-title"
            className="legend text-[11px] font-semibold text-ink"
          >
            Calibration record
          </h2>
          <p className="font-mono text-[11px] leading-5 text-graphite">
            {HEADER.map((part, i) => (
              <span key={part}>
                <span className="whitespace-nowrap">
                  {part}
                  {i < HEADER.length - 1 && " ·"}
                </span>{" "}
              </span>
            ))}
          </p>
        </header>

        <dl className="grid divide-y divide-hairline border-b border-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FIGURES.map((figure) => (
            <div
              key={figure.label}
              className="flex flex-col-reverse gap-3 px-5 py-7 sm:px-10 sm:py-9"
            >
              <dt className="text-sm text-balance text-graphite">
                {figure.label}
              </dt>
              <dd className="font-mono text-5xl leading-none font-light tracking-tight tabular-nums">
                {figure.value}
              </dd>
            </div>
          ))}
        </dl>

        <table className="w-full text-sm">
          <caption className="sr-only">
            Test points, with the requirement each had to meet
          </caption>
          <thead>
            <tr className="legend text-left text-[10px] text-graphite">
              <th scope="col" className="px-5 py-3 font-semibold sm:pl-10">
                Test
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Measured
              </th>
              <th scope="col" className="px-3 py-3 font-semibold max-sm:hidden">
                Required
              </th>
              <th scope="col" className="py-3 pr-5 pl-3 font-semibold sm:pr-10">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline border-t border-hairline">
            {TEST_POINTS.map((point) => (
              <tr key={point.name}>
                <th
                  scope="row"
                  className="px-5 py-3 text-left font-normal text-pretty sm:pl-10"
                >
                  {point.name}
                  {point.required && (
                    <span className="mt-0.5 block font-mono text-[11px] text-pretty text-graphite sm:hidden">
                      {point.required}
                    </span>
                  )}
                </th>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {point.measured}
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-pretty text-graphite max-sm:hidden">
                  {point.required ?? ""}
                </td>
                <td className="py-3 pr-5 pl-3 font-mono text-[11px] sm:pr-10">
                  {point.passed === undefined ? null : point.passed ? (
                    "pass"
                  ) : (
                    <span className="text-destructive">fail</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="border-t border-hairline px-5 py-4 font-mono text-[11px] leading-5 text-pretty text-graphite sm:px-10">
          The three figures above are at the shipped bars. The table's top
          guesses are before them, when the model has to answer every paragraph.
        </p>
      </div>
    </section>
  )
}
