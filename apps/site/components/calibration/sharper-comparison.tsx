import { REPORT, REPORT_LM } from "@/lib/calibration"
import { percent } from "@/lib/format"

const base = REPORT.decision
const lm = REPORT_LM.decision

const ROWS = [
  {
    name: "Says can't tell",
    base: base.shipped.unsureRate,
    lm: lm.shipped.unsureRate,
  },
  {
    name: "Right when it makes a call",
    base: base.shipped.accuracyDecided,
    lm: lm.shipped.accuracyDecided,
  },
  {
    name: "Human text called machine-ish",
    base: base.shipped.falseMachineRateOnHuman,
    lm: lm.shipped.falseMachineRateOnHuman,
  },
  {
    name: "Web check, called machine-ish or mixed",
    base: base.web.machine + base.web.mixed,
    lm: lm.web.machine + lm.web.mixed,
  },
  {
    name: "Web check, called human-ish",
    base: base.web.human,
    lm: lm.web.human,
  },
]

export function SharperComparison() {
  return (
    <table className="w-full max-w-2xl text-sm">
      <caption className="sr-only">
        The standard model against sharper reading, at the shipped bars
      </caption>
      <thead>
        <tr className="legend text-[10px] text-graphite">
          <th scope="col" className="py-3 pr-3 text-left font-semibold">
            Measure
          </th>
          <th scope="col" className="px-3 py-3 text-right font-semibold">
            Standard
          </th>
          <th scope="col" className="py-3 pl-3 text-right font-semibold">
            Sharper
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline border-y border-hairline">
        {ROWS.map((row) => (
          <tr key={row.name}>
            <th
              scope="row"
              className="py-3 pr-3 text-left font-normal text-pretty"
            >
              {row.name}
            </th>
            <td className="px-3 py-3 text-right font-mono text-graphite tabular-nums">
              {percent(row.base, 1)}
            </td>
            <td className="py-3 pl-3 text-right font-mono tabular-nums">
              {percent(row.lm, 1)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
