interface SectionProps {
  id: string
  label: string
  title: string
  lead?: React.ReactNode
  children: React.ReactNode
}

export function Section({ id, label, title, lead, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-t border-hairline"
    >
      <div className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 sm:py-24">
        <header className="mb-12 max-w-2xl">
          <p className="legend mb-4 text-[10px] font-semibold text-graphite">
            {label}
          </p>
          <h2
            id={`${id}-title`}
            className="text-3xl/tight font-semibold tracking-[-0.02em] text-balance [font-stretch:112%]"
          >
            {title}
          </h2>
          {lead && (
            <p className="mt-4 max-w-lg text-base/relaxed text-pretty text-graphite">
              {lead}
            </p>
          )}
        </header>
        {children}
      </div>
    </section>
  )
}
