import { REPORT, SOURCES, type SourceKind } from "@/lib/calibration"
import { DECISION_LABEL as LABEL } from "@slop/model"
import { COLOR } from "@/lib/decisions"
import { integer, percent } from "@/lib/format"

type Row = {
  key: string
  name: string
  kind: SourceKind
  n: number
  accuracy: number
}

const rows: Row[] = Object.entries(REPORT.model.bySource).map(
  ([key, source]) => ({
    key,
    ...SOURCES[key],
    n: source.n,
    accuracy: source.accuracy,
  })
)
const byAccuracy = (a: Row, b: Row) => b.accuracy - a.accuracy

const GROUPS = [
  {
    title: "Test sources",
    rows: rows.filter((row) => row.key.startsWith("test:")).sort(byAccuracy),
  },
  {
    title: "Held-out attacks",
    rows: rows.filter((row) => row.key.startsWith("adv:")).sort(byAccuracy),
  },
  {
    title: "Held-out sites",
    rows: rows.filter((row) => row.key.startsWith("web:")).sort(byAccuracy),
  },
]

function Kind({ kind }: { kind: SourceKind }) {
  const answers = kind === "both" ? (["human", "machine"] as const) : [kind]
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-graphite">
      {answers.map((answer) => (
        <span
          key={answer}
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: COLOR[answer] }}
        />
      ))}
      {kind === "both" ? "human and machine" : LABEL[kind].replace("-ish", "")}
    </span>
  )
}

export function SourceAccuracy() {
  return (
    <div className="space-y-12">
      {GROUPS.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h3 className="legend mb-2 text-[10px] font-semibold text-graphite">
            {group.title}
          </h3>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {group.rows.map((row) => (
              <li
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,16rem)_3.5rem]"
              >
                <div className="min-w-0">
                  <p className="text-[15px] text-pretty">{row.name}</p>
                  <Kind kind={row.kind} />
                </div>
                <p className="font-mono text-[11px] text-graphite tabular-nums max-sm:hidden">
                  {integer(row.n)}
                </p>
                <span
                  aria-hidden
                  className="h-1.5 overflow-hidden rounded-full bg-muted max-sm:col-span-2 max-sm:row-start-2"
                >
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{ width: `${row.accuracy * 100}%` }}
                  />
                </span>
                <p className="text-right font-mono text-sm tabular-nums max-sm:col-start-2 max-sm:row-start-1">
                  {percent(row.accuracy)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
