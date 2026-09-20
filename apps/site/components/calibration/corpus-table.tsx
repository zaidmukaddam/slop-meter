import { CLASSES } from "@slop/model"
import { REPORT } from "@/lib/calibration"
import { integer } from "@/lib/format"

const SPLITS = [
  { key: "train", name: "Training" },
  { key: "val", name: "Validation" },
  { key: "test", name: "Test" },
  { key: "adv", name: "Held-out attacks" },
  { key: "web", name: "Held-out sites" },
] as const

export function CorpusTable() {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full text-sm">
        <caption className="sr-only">Paragraphs per split and label</caption>
        <thead>
          <tr className="legend text-[10px] text-graphite">
            <th scope="col" className="py-3 pr-3 text-left font-semibold">
              Split
            </th>
            {CLASSES.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-3 py-3 text-right font-semibold"
              >
                {c}
              </th>
            ))}
            <th scope="col" className="py-3 pl-3 text-right font-semibold">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline border-y border-hairline">
          {SPLITS.map((split) => {
            const counts = REPORT.corpus[split.key]
            const total = CLASSES.reduce((sum, c) => sum + counts[c], 0)
            return (
              <tr key={split.key}>
                <th scope="row" className="py-3 pr-3 text-left font-normal">
                  {split.name}
                </th>
                {CLASSES.map((c) => (
                  <td
                    key={c}
                    className="px-3 py-3 text-right font-mono text-graphite tabular-nums"
                  >
                    {counts[c] ? integer(counts[c]) : "–"}
                  </td>
                ))}
                <td className="py-3 pl-3 text-right font-mono tabular-nums">
                  {integer(total)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
