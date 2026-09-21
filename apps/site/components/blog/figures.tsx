import { DECISION_LABEL as LABEL, type Decision } from "@slop/model"
import Image from "next/image"
import { Dial } from "@/components/meter/dial"
import { COLOR } from "@/lib/decisions"
import { percent } from "@/lib/format"
import { MODELS } from "@/lib/models"
import type { FigureId, PostFacts } from "@/lib/posts/introducing-slop-meter"

export function PostFigure({
  figure,
  facts,
}: {
  figure: FigureId
  facts: PostFacts
}) {
  if (figure === "answers") return <Answers />
  if (figure === "extension") return <Extension />
  if (figure === "numbers") return <Numbers facts={facts} />
  return <ModelsTable />
}

function Frame({
  caption,
  wide,
  children,
}: {
  caption: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <figure className={wide ? "my-14 lg:-mx-40 xl:-mx-56" : "my-14 lg:-mx-16"}>
      {children}
      <figcaption className="mt-4 font-mono text-[11px] text-pretty text-graphite">
        {caption}
      </figcaption>
    </figure>
  )
}

const READINGS: { decision: Decision; needle: number }[] = [
  { decision: "human", needle: 0.04 },
  { decision: "mixed", needle: 0.5 },
  { decision: "unsure", needle: 0.68 },
  { decision: "machine", needle: 0.98 },
]

function Answers() {
  return (
    <Frame
      wide
      caption="The needle shows how machine-shaped a paragraph is. The answer is a separate decision: a needle at 68 is a lean, and the meter calls it can't tell."
    >
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
        {READINGS.map(({ decision, needle }) => (
          <li key={decision}>
            <Dial
              compact
              value={needle}
              label={`Needle at ${Math.round(needle * 100)}, ${LABEL[decision]}`}
              className="block w-full"
            />
            <p className="legend mt-3 flex items-center gap-2 text-[11px] font-semibold">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: COLOR[decision] }}
              />
              {LABEL[decision]}
            </p>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function Extension() {
  return (
    <Frame
      wide
      caption="The extension on a test page. Grey dots are can't tell, orange is machine-ish. The card names the rules behind the orange one and marks the words that set them off."
    >
      <Image
        src="/blog/extension-card.png"
        alt="A blog post with a small dot in the margin beside each paragraph. One dot is orange, and beside it a card reads machine-ish, 98%, pushed by significance inflation, stock vocabulary and lexical diversity."
        width={2360}
        height={1720}
        sizes="(min-width: 1280px) 1128px, (min-width: 1024px) 1000px, 100vw"
        className="h-auto w-full rounded-md outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
      />
    </Frame>
  )
}

function Numbers({ facts }: { facts: PostFacts }) {
  const stats = [
    { value: facts.answers, label: "of paragraphs get an answer" },
    { value: facts.right, label: "of those answers are right" },
    {
      value: facts.webMachine,
      label: `of ${facts.webN} human web paragraphs called machine-ish`,
    },
  ]
  return (
    <Frame caption="Held-out paragraphs and the 2019 web check, at the bars the standard model ships with.">
      <dl className="grid gap-x-10 gap-y-8 border-y border-hairline py-8 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-2">
            <dt className="text-sm text-balance text-graphite">{stat.label}</dt>
            <dd className="font-mono text-[2.5rem] leading-none font-light tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </Frame>
  )
}

function ModelsTable() {
  const rows = [
    {
      name: "Says can't tell",
      values: MODELS.map((m) =>
        percent(m.report.decision.shipped.unsureRate, 1)
      ),
    },
    {
      name: "Right when it makes a call",
      values: MODELS.map((m) =>
        percent(m.report.decision.shipped.accuracyDecided, 1)
      ),
    },
    {
      name: "Human web pages called machine-ish",
      values: MODELS.map((m) => percent(m.report.decision.web.machine, 2)),
    },
    { name: "Download", values: ["none", "125 MB, once"] },
  ]
  return (
    <Frame caption="Both models on the same held-out paragraphs and the same web check.">
      <table className="w-full text-sm">
        <thead>
          <tr className="legend text-[10px] text-graphite">
            <th scope="col" className="py-3 pr-3 text-left font-semibold">
              Measure
            </th>
            {MODELS.map((model) => (
              <th
                key={model.id}
                scope="col"
                className="py-3 pl-3 text-right font-semibold"
              >
                {model.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline border-y border-hairline">
          {rows.map((row) => (
            <tr key={row.name}>
              <th
                scope="row"
                className="py-3 pr-3 text-left font-sans font-normal text-pretty"
              >
                {row.name}
              </th>
              {row.values.map((value, i) => (
                <td
                  key={MODELS[i].id}
                  className="py-3 pl-3 text-right font-mono text-[13px] tabular-nums"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  )
}
