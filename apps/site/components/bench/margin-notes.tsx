import { RULE_FIRED, type Reason } from "@slop/model"
import { tellSpans } from "@slop/rules/names"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface MarginNotesProps {
  reasons: Reason[]
  top: number
  className?: string
}

export function MarginNotes({ reasons, top, className }: MarginNotesProps) {
  return (
    <div className={cn("absolute right-0 bottom-0", className)} style={{ top }}>
      <div className="sticky top-[calc(var(--reading-line)-0.625rem)] animate-in pt-3 duration-200 fade-in">
        <p className="legend text-[10px] font-semibold text-graphite">
          Pushed by
        </p>
        {reasons.length ? (
          <ul className="mt-3 space-y-3">
            {reasons.map((reason) => {
              const found = reason.value > RULE_FIRED
              const inked = found && tellSpans(reason).length > 0
              return (
                <li
                  key={reason.id}
                  className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-x-2.5 gap-y-1 text-sm"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 rounded-[2px]",
                      inked ? "bg-marker" : "border border-etch"
                    )}
                  />
                  <span className="text-pretty">{reason.name}</span>
                  <span className="col-start-2 flex items-center gap-2.5 font-mono text-[11px] text-graphite">
                    {found ? (
                      <span
                        aria-hidden
                        className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-graphite"
                          style={{ width: `${reason.value * 100}%` }}
                        />
                      </span>
                    ) : (
                      <span>absent</span>
                    )}
                    <Link
                      href={`/rules#${reason.id}`}
                      aria-label={`${reason.name}, ${reason.id} in the rulebook`}
                      className="relative rounded-sm underline-offset-2 transition-colors after:absolute after:-inset-x-2 after:-inset-y-3 hover:text-ink hover:underline"
                    >
                      {reason.id}
                    </Link>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-pretty text-graphite">
            No rule stands out here, so the call comes from sentence rhythm and
            word choice.
          </p>
        )}
      </div>
    </div>
  )
}
