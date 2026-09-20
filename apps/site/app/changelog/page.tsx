import type { Metadata } from "next"
import { PageIntro } from "@/components/page-intro"
import { readReleases } from "@/lib/changelog"
import { keepUnits } from "@/lib/format"

export const metadata: Metadata = {
  title: "Changelog",
  alternates: { canonical: "/changelog" },
  description:
    "Every release of Slop Meter: what changed in the extension, the site and the models, with the numbers each release shipped with.",
}

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

export default async function ChangelogPage() {
  const releases = await readReleases()

  return (
    <>
      <PageIntro label="Changelog" title="What changed, and when">
        <p>
          One entry per release, newest first. Numbers in an entry are the ones
          that release shipped with, so an old entry keeps its old numbers.
        </p>
      </PageIntro>

      <div className="border-t border-hairline">
        <ol className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          {releases.map((release) => (
            <li
              key={release.version}
              id={`v${release.version}`}
              className="grid gap-x-16 gap-y-6 border-b border-hairline py-16 last:border-b-0 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-20"
            >
              <header className="lg:sticky lg:top-8 lg:self-start">
                <h2 className="font-mono text-[2.5rem] leading-none font-light tracking-tight tabular-nums">
                  {release.version}
                </h2>
                {release.date && (
                  <p className="legend mt-3 text-[10px] font-semibold text-graphite">
                    <time dateTime={release.date}>{day(release.date)}</time>
                  </p>
                )}
              </header>

              <div className="max-w-2xl">
                {release.blocks.map((block, i) =>
                  block.kind === "paragraph" ? (
                    <p
                      key={i}
                      className="mb-8 text-[19px]/relaxed text-pretty text-ink"
                    >
                      {keepUnits(block.text)}
                    </p>
                  ) : (
                    <ul key={i} className="border-t border-hairline">
                      {block.items.map((item) => (
                        <li
                          key={item}
                          className="border-b border-hairline py-4 text-[15px]/relaxed text-pretty text-graphite"
                        >
                          {keepUnits(item)}
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
