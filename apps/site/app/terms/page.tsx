import type { Metadata } from "next"
import Link from "next/link"
import { PageIntro } from "@/components/page-intro"

const UPDATED = "2026-09-22"
const CONTACT = "hey@zaidmukaddam.com"

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "/terms" },
  description:
    "The terms for using slop-meter.com and the Slop Meter extension: a guess about style, free to use, no warranty.",
}

const SECTIONS = [
  {
    title: "A mark is a guess",
    body: [
      "Slop Meter reads the style of a paragraph and gives odds that a model wrote it. It can't tell you who wrote something. People write in ways that look machine-made, and models can be told to write like people.",
      "Don't use a mark as the only reason to accuse, grade, discipline, fire or refuse anyone. If a decision matters, talk to the person.",
    ],
  },
  {
    title: "Free, and as it is",
    body: [
      "The extension and this site are free. They come as they are, without any warranty that they are accurate, available or fit for a purpose. The numbers on the models page are measured on held-out text, and your text may behave differently.",
      "We are not liable for decisions made with Slop Meter or for any loss that comes from using it, as far as the law allows.",
    ],
  },
  {
    title: "Using Rewrite and shared corrections",
    body: [
      "Rewrite and shared corrections are opt-in and send data to slop-meter.com, as the privacy page describes. Rewrite has a daily limit per person. Don't script around the limit, send text you have no right to share, or use either feature to attack or overload the service.",
      "We can change, limit or switch off either feature at any time.",
    ],
  },
  {
    title: "The code",
    body: [
      "Slop Meter's code, rulebook and training scripts are open source under the GNU Affero General Public License v3.0. That licence, not these terms, covers copying and changing the code.",
    ],
  },
  {
    title: "Changes",
    body: [
      "We may update these terms. The date at the bottom changes when we do, and using Slop Meter after that means you accept the new version.",
    ],
  },
]

export default function TermsPage() {
  return (
    <>
      <PageIntro label="Terms" title="Terms of use">
        <p>
          Short version: it's free, it's a guess about style, and it shouldn't
          be the only reason anyone gets accused of anything.
        </p>
      </PageIntro>

      <div className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="grid gap-x-16 gap-y-4 border-b border-hairline py-12 lg:grid-cols-[22rem_minmax(0,1fr)] lg:py-16"
            >
              <h2 className="text-xl font-semibold text-balance">
                {section.title}
              </h2>
              <div className="max-w-2xl space-y-4 text-[17px]/relaxed text-pretty text-graphite">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="max-w-2xl py-10 text-sm/relaxed text-pretty text-graphite">
            See also the{" "}
            <Link href="/privacy" className="underline">
              privacy page
            </Link>
            . Questions:{" "}
            <a href={`mailto:${CONTACT}`} className="underline">
              {CONTACT}
            </a>
            . Last updated <time dateTime={UPDATED}>22 September 2026</time>.
          </p>
        </div>
      </div>
    </>
  )
}
