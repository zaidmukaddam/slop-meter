import {
  DIAL_ORDER as ORDER,
  DECISION_LABEL as LABEL_FOR,
  type Score,
  shownP,
} from "@slop/model"
import { Dial } from "@/components/meter/dial"
import { Section } from "@/components/section"
import { COLOR, machineShare } from "@/lib/decisions"
import { keepUnits, percent } from "@/lib/format"
import { MODELS, SPECS } from "@/lib/models"
import type { Demo } from "@/lib/models-demo"
import { cn } from "@/lib/utils"

const COLUMNS =
  "grid grid-cols-2 gap-x-6 sm:gap-x-12 lg:grid-cols-[15rem_minmax(0,1fr)_minmax(0,1fr)]"

export function Reading({ name, score }: { name: string; score: Score }) {
  const decided = score.localDecision !== "unsure"
  const shown = Math.round(machineShare(score) * 100)
  return (
    <div className="max-w-[22rem]">
      <Dial
        value={machineShare(score)}
        label={`${name}: needle at ${shown} percent machine-shaped`}
        className="w-full rounded-[14px] border border-hairline"
      />
      <p
        className={cn(
          "mt-5 font-mono text-[2.5rem] leading-none font-light tracking-tight tabular-nums sm:text-[3.5rem]",
          !decided && "text-graphite/60"
        )}
      >
        {shown}
        <span className="text-[0.45em]">%</span>
      </p>
      <p className="legend mt-2 flex items-center gap-2 text-[13px] font-semibold">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: COLOR[score.localDecision] }}
        />
        {LABEL_FOR[score.localDecision]}
      </p>
      <div
        aria-hidden
        className="mt-4 flex h-1 overflow-hidden rounded-full bg-muted"
      >
        {ORDER.map((c) => (
          <span
            key={c}
            style={{ width: `${score.probs[c] * 100}%`, background: COLOR[c] }}
          />
        ))}
      </div>
      <p className="mt-2 min-h-[3lh] font-mono text-[11px] text-pretty text-graphite tabular-nums sm:min-h-[2lh]">
        {decided
          ? `${percent(shownP(score.localP))} sure it's ${LABEL_FOR[score.localDecision]}.`
          : `Leans ${LABEL_FOR[score.top]}, ${percent(score.localP)} sure. Not enough to say so.`}
      </p>
    </div>
  )
}

export function Compare({ demo }: { demo: Demo }) {
  return (
    <Section
      id="compare"
      label="Side by side"
      title="The same paragraph, read by both"
      lead="Both lean the same way. Only Sharper is sure enough to say so."
    >
      <div className={COLUMNS}>
        <figure className="max-lg:col-span-2 max-lg:mb-10">
          <figcaption className="legend text-[10px] font-semibold text-graphite">
            The paragraph
          </figcaption>
          <blockquote className="mt-4 font-serif text-[15px]/relaxed text-pretty lg:text-sm/relaxed">
            {demo.text}
          </blockquote>
          <p className="mt-3 font-mono text-[11px] text-graphite">
            {demo.source} · {demo.words} words
          </p>
        </figure>
        {MODELS.map((model, i) => (
          <div key={model.id} className="min-w-0">
            <Reading name={model.name} score={demo.scores[i]} />
            <h3 className="mt-8 text-[clamp(1.5rem,8vw,2.25rem)] leading-none font-light tracking-[-0.03em] [font-stretch:112%] sm:text-[3.25rem]">
              {model.name}
            </h3>
            <p className="legend mt-3 text-[10px] font-semibold text-graphite">
              {model.role}
            </p>
          </div>
        ))}
      </div>

      {SPECS.map((spec) => (
        <section key={spec.title} aria-label={spec.title}>
          <h3 className="legend mt-14 border-b border-hairline pb-3 text-[10px] font-semibold text-graphite sm:mt-20">
            {spec.title}
          </h3>
          <dl>
            {spec.rows.map((row) => (
              <div
                key={row.label}
                className={cn(COLUMNS, "border-b border-hairline py-6 sm:py-7")}
              >
                <dt className="text-[13px] text-pretty text-graphite max-lg:col-span-2 max-lg:mb-3 lg:pt-2">
                  {row.label}
                </dt>
                {row.cells.map((cell, i) => (
                  <dd key={MODELS[i].id} className="min-w-0">
                    <span className="sr-only">{MODELS[i].name}: </span>
                    <p
                      className={cn(
                        "font-light tracking-tight tabular-nums",
                        /^(\d.{0,7}|—)$/.test(cell.value)
                          ? "font-mono text-3xl leading-none sm:text-4xl"
                          : "text-2xl leading-[1.15] text-balance [font-stretch:112%] sm:text-3xl",
                        cell.value === "—" && "text-graphite"
                      )}
                    >
                      {keepUnits(cell.value)}
                    </p>
                    {cell.note && (
                      <p className="mt-2.5 max-w-[16rem] text-sm text-pretty text-graphite">
                        {keepUnits(cell.note)}
                      </p>
                    )}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Section>
  )
}
