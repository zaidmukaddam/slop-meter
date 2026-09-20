import { Numbers } from "@sfinterface/numbers"
import "@sfinterface/numbers/styles.css"
import {
  DIAL_ORDER as ORDER,
  DECISION_LABEL as LABEL,
  type Score,
  shownP,
} from "@slop/model"
import { Skeleton } from "@/components/ui/skeleton"
import { COLOR, machineShare } from "@/lib/decisions"
import { percent } from "@/lib/format"
import { cn } from "@/lib/utils"

interface ReadoutProps {
  score: Score | undefined
  loading: boolean
  minWords: number
  caption: string
}

export function Readout({ score, loading, minWords, caption }: ReadoutProps) {
  if (!score)
    return loading ? <ReadoutSkeleton /> : <NothingToRead minWords={minWords} />

  const decided = score.localDecision !== "unsure"
  const shown = Math.round(machineShare(score) * 100)

  return (
    <div aria-live="polite" className="min-w-0">
      <p className="truncate font-mono text-[11px] text-graphite">{caption}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-[2.5rem] leading-none font-light tracking-tight lg:mt-2 lg:text-[3.5rem]",
          !decided && "text-graphite/60"
        )}
      >
        <Numbers
          value={shown}
          label={`${shown}% machine-shaped`}
          suffix={<span className="text-[0.45em]">%</span>}
        />
      </p>
      <p className="legend mt-2 flex items-center gap-2 text-[13px] font-semibold">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: COLOR[score.localDecision] }}
        />
        {LABEL[score.localDecision]}
      </p>

      <div className="mt-4 hidden lg:block">
        <div
          aria-hidden
          className="flex h-1 overflow-hidden rounded-full bg-muted"
        >
          {ORDER.map((c) => (
            <span
              key={c}
              style={{
                width: `${score.probs[c] * 100}%`,
                background: COLOR[c],
              }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[11px] text-pretty text-graphite tabular-nums lg:min-h-[2lh] xl:min-h-0">
          {decided
            ? `${percent(shownP(score.localP))} sure it's ${LABEL[score.localDecision]}, right about that often on held-out text.`
            : `Leans ${LABEL[score.top]}, ${percent(score.localP)} sure. It calls at ${percent(score.bar)}.`}
        </p>
      </div>
    </div>
  )
}

function NothingToRead({ minWords }: { minWords: number }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[11px] text-graphite">Waiting for text</p>
      <p className="mt-1.5 font-mono text-[2.5rem] leading-none font-light tracking-tight text-etch lg:mt-2 lg:text-[3.5rem]">
        --<span className="text-[0.45em]">%</span>
      </p>
      <p className="legend mt-2 text-[13px] font-semibold text-graphite">
        Nothing to read
      </p>
      <div className="mt-4 hidden lg:block">
        <div aria-hidden className="h-1 rounded-full bg-muted" />
        <p className="mt-2 font-mono text-[11px] text-pretty text-graphite lg:min-h-[2lh] xl:min-h-0">
          A paragraph needs {minWords} words to get a reading.
        </p>
      </div>
    </div>
  )
}

function ReadoutSkeleton() {
  return (
    <div aria-hidden className="min-w-0">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="mt-2 h-10 w-24 lg:h-14 lg:w-32" />
      <Skeleton className="mt-2 h-4 w-28" />
      <div className="mt-4 hidden lg:block">
        <Skeleton className="h-1 w-full" />
        <div className="mt-2 font-mono text-[11px] lg:min-h-[2lh] xl:min-h-0">
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
    </div>
  )
}
