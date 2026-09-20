interface PageIntroProps {
  label?: string
  title: React.ReactNode
  children: React.ReactNode
}

export function PageIntro({ label, title, children }: PageIntroProps) {
  return (
    <section className="mx-auto grid w-full max-w-[1200px] gap-x-16 gap-y-8 px-5 pt-12 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:pt-16 lg:pb-12">
      <div>
        {label && (
          <p className="legend mb-5 text-[10px] font-semibold text-graphite">
            {label}
          </p>
        )}
        <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance [font-stretch:112%] sm:text-[3.6rem] lg:text-[4rem]">
          {title}
        </h1>
      </div>
      <div className="max-w-xl text-[17px]/relaxed text-pretty text-graphite">
        {children}
      </div>
    </section>
  )
}
