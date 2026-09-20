import {
  DECISIONS,
  DECISION_LABEL as LABEL,
  type Decision,
  type Score,
} from "@slop/model"
import { COLOR } from "@/lib/decisions"
import { percent } from "@/lib/format"
import { cn } from "@/lib/utils"

interface DistributionProps {
  scores: (Score | undefined)[]
  className?: string
}

export function Distribution({ scores, className }: DistributionProps) {
  const scored = scores.filter((s): s is Score => !!s && !s.tooShort)
  const share = (d: Decision) =>
    scored.filter((s) => s.localDecision === d).length / scored.length
  const present = scored.length
    ? DECISIONS.filter((d) => share(d) > 0).toSorted(
        (a, b) => share(b) - share(a)
      )
    : []

  return (
    <div
      className={cn(
        "flex min-h-5 items-center gap-3 font-mono text-[11px] text-graphite tabular-nums",
        className
      )}
    >
      {present.length > 0 && (
        <>
          <span
            aria-hidden
            className="flex h-1 w-20 overflow-hidden rounded-full bg-muted"
          >
            {present.map((d) => (
              <span
                key={d}
                style={{ width: `${share(d) * 100}%`, background: COLOR[d] }}
              />
            ))}
          </span>
          <span>
            {present.map((d) => `${percent(share(d))} ${LABEL[d]}`).join(" · ")}
          </span>
        </>
      )}
    </div>
  )
}
