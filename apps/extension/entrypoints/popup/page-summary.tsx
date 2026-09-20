import { distribution, totalScored } from "./distribution"
import type { PopupState } from "./store"

type Props = { summary: PopupState["summary"] }

export function PageSummary({ summary }: Props) {
  return (
    <section aria-labelledby="page-title" className="space-y-3">
      <h2
        id="page-title"
        className="legend text-[10px] font-semibold text-graphite"
      >
        This page
      </h2>
      <Distribution summary={summary} />
    </section>
  )
}

function Distribution({ summary }: Props) {
  if (!summary) return <div className="h-5" />
  if (summary === "unavailable") {
    return (
      <Note>
        Slop Meter isn't running on this page. If the page was open before you
        installed it, reload the page. It can't run on Chrome's own pages or the
        Web Store.
      </Note>
    )
  }
  if (!summary.on) return <Note>Off on this page.</Note>

  const shares = distribution(summary.counts)
  if (shares.length === 0) {
    return <Note>No paragraphs scored yet. It scores them as you scroll.</Note>
  }
  const total = totalScored(summary.counts)
  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label="Paragraph distribution"
        className="flex h-1.5 overflow-hidden rounded-full bg-muted"
      >
        {shares.map((share) => (
          <span
            key={share.decision}
            style={{ width: `${share.percent}%`, background: share.color }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {shares.map((share) => (
          <li key={share.decision} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ background: share.color }}
            />
            <span>
              <span className="font-mono tabular-nums">{share.percent}%</span>{" "}
              <span className="text-graphite">{share.name}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-pretty text-graphite tabular-nums">
        {total} paragraph{total === 1 ? "" : "s"} scored so far. Each gets its
        own call. There's no page score.
      </p>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-pretty text-graphite">{children}</p>
}
