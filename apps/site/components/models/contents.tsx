const ENTRIES = [
  { id: "pair", label: "The pair" },
  { id: "compare", label: "Side by side" },
  { id: "language-model", label: "Sharper reading" },
  { id: "record", label: "The record" },
  { id: "web", label: "Web check" },
  { id: "threshold", label: "Bars" },
  { id: "reliability", label: "Reliability" },
  { id: "sources", label: "Sources" },
  { id: "data", label: "Data" },
  { id: "choosing", label: "Choosing" },
]

export function Contents() {
  return (
    <nav
      aria-label="On this page"
      className="mx-auto w-full max-w-[1200px] px-5 pb-12 sm:px-8"
    >
      <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline pt-4 text-[13px] text-graphite">
        {ENTRIES.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className="hover:text-ink">
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
