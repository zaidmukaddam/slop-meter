import study from "@slop/eval/jev-study.json"
import { integer, percent } from "@/lib/format"

type Summary = typeof study.local

const READERS: { name: string; what: string; held: Summary; web: Summary }[] = [
  {
    name: "Standard",
    what: "Runs in your browser",
    held: study.local,
    web: study.web.local,
  },
  {
    name: "Sharper",
    what: "Runs in your browser",
    held: study.sharper,
    web: study.web.sharper,
  },
  {
    name: "Jev",
    what: "A hosted AI judge",
    held: study.jev,
    web: study.web.jev,
  },
]

function counts(s: Summary) {
  const verdicts = Math.round((1 - s.unsureRate) * s.n)
  const right = Math.round(verdicts * (s.accuracyDecided ?? 0))
  return { right, wrong: verdicts - right, quiet: s.n - verdicts }
}

const PARTS = [
  { key: "right", label: "Right", className: "bg-ink" },
  { key: "wrong", label: "Wrong", className: "bg-machine" },
  { key: "quiet", label: "Can't tell", className: "bg-muted" },
] as const

export function Benchmark() {
  const point = study.operatingPoint
  return (
    <div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-graphite">
        {PARTS.map((part) => (
          <li key={part.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`size-2.5 rounded-full ${part.className}`}
            />
            {part.label}
          </li>
        ))}
      </ul>

      <div className="mt-6 border-b border-hairline">
        {READERS.map((reader) => {
          const c = counts(reader.held)
          const flagged = Math.round(
            reader.web.falseMachineRateOnHuman * reader.web.n
          )
          return (
            <section
              key={reader.name}
              aria-label={reader.name}
              className="grid gap-x-12 gap-y-5 border-t border-hairline py-7 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-9"
            >
              <div>
                <h3 className="text-2xl font-light tracking-[-0.02em] [font-stretch:112%] sm:text-3xl">
                  {reader.name}
                </h3>
                <p className="legend mt-2 text-[10px] font-semibold text-graphite">
                  {reader.what}
                </p>
              </div>
              <div className="min-w-0">
                <div
                  role="img"
                  aria-label={`${c.right} right, ${c.wrong} wrong, ${c.quiet} can't tell, out of ${reader.held.n}`}
                  className="flex h-3 gap-px overflow-hidden rounded-full"
                >
                  {PARTS.map((part) => (
                    <span
                      key={part.key}
                      className={part.className}
                      style={{ flexGrow: c[part.key], flexBasis: 0 }}
                    />
                  ))}
                </div>
                <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-3">
                  {[
                    {
                      value: integer(c.wrong),
                      label: `wrong verdicts, out of ${integer(reader.held.n)} paragraphs`,
                    },
                    {
                      value: percent(reader.held.accuracyDecided),
                      label: `right, of the ${integer(c.right + c.wrong)} verdicts it gave`,
                    },
                    {
                      value: integer(flagged),
                      label: `of ${integer(reader.web.n)} web paragraphs by people, called machine-ish`,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex flex-row-reverse items-baseline justify-end gap-4 sm:flex-col-reverse sm:items-start sm:justify-start sm:gap-1.5"
                    >
                      <dt className="min-w-0 text-[13px] text-pretty text-graphite">
                        {stat.label}
                      </dt>
                      <dd className="w-24 shrink-0 font-mono text-4xl leading-none font-light tracking-tight tabular-nums sm:w-auto">
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          )
        })}
      </div>

      <p className="mt-6 max-w-2xl text-[13px]/relaxed text-pretty text-graphite">
        Jev answers almost every time, and that is where its mistakes come from.
        Made to stay quiet as often as each other, Jev is right{" "}
        {percent(point.jev.accuracyDecided)} of the time and Standard{" "}
        {percent(point.local.accuracyDecided)}, too close to call on a sample
        this size. Jev is typesafe-ai/jev, asked through an API on {study.date}.
        It was given Standard&apos;s measurements of each paragraph, not the
        text. Standard and Sharper read the same paragraphs with the weights
        that ship.
      </p>
    </div>
  )
}
