import { RULES } from "@slop/rules"
import type { Metadata } from "next"
import Link from "next/link"
import { PostCover } from "@/components/blog/cover"
import { PostFigure } from "@/components/blog/figures"
import { integer, percent } from "@/lib/format"
import { MODELS } from "@/lib/models"
import { longDate } from "@/lib/posts"
import { loadCover } from "@/lib/posts/cover"
import { type PostFacts, body, meta } from "@/lib/posts/introducing-slop-meter"

const [standard, sharper] = MODELS
const shipped = standard.report.decision.shipped
const web = standard.report.decision.web

const FACTS: PostFacts = {
  kb: `${Math.round(standard.manifest.bytes / 1024)} KB`,
  numbers: integer(standard.manifest.features.length),
  rules: integer(RULES.length),
  heldOut: integer(standard.report.model.test.n),
  answers: percent(1 - shipped.unsureRate),
  right: percent(shipped.accuracyDecided),
  humanCalledMachine: percent(shipped.falseMachineRateOnHuman, 2),
  webN: integer(web.n),
  webMachine: percent(web.machine, 2),
  sharperAnswers: percent(1 - sharper.report.decision.shipped.unsureRate),
  download: "125 MB",
  arch: standard.report.model.arch.match(/\d+/g)!.join(" → "),
  sharperArch: sharper.report.model.arch.match(/\d+/g)!.join(" → "),
  params: integer(standard.manifest.params),
  trainN: integer(
    Object.values(standard.report.corpus.train).reduce((a, b) => a + b, 0)
  ),
  source: process.env.NEXT_PUBLIC_SOURCE_URL ?? null,
}

export const metadata: Metadata = {
  title: meta.title,
  description: meta.dek,
  alternates: { canonical: `/blog/${meta.slug}` },
  authors: [{ name: meta.author }],
  openGraph: {
    type: "article",
    title: meta.title,
    description: meta.dek,
    publishedTime: meta.date,
    authors: [meta.author],
  },
}

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let from = 0
  for (const match of text.matchAll(LINK)) {
    parts.push(text.slice(from, match.index))
    const [, label, href] = match
    parts.push(
      href.startsWith("/") ? (
        <Link key={match.index} href={href} className="text-ink underline">
          {label}
        </Link>
      ) : (
        <a key={match.index} href={href} className="text-ink underline">
          {label}
        </a>
      )
    )
    from = match.index + match[0].length
  }
  parts.push(text.slice(from))
  return parts
}

export default async function IntroducingSlopMeter() {
  const cover = await loadCover()
  return (
    <article>
      <header className="mx-auto w-full max-w-[1200px] px-5 pt-12 pb-12 sm:px-8 lg:pt-16">
        <p className="legend mb-5 text-[10px] font-semibold text-graphite">
          <Link href="/blog" className="hover:text-ink">
            Blog
          </Link>
        </p>
        <h1 className="max-w-4xl text-[2.6rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance [font-stretch:112%] sm:text-[3.6rem] lg:text-[4rem]">
          {meta.title}
        </h1>
        <p className="mt-8 max-w-2xl text-[19px]/relaxed text-pretty text-graphite">
          {meta.dek}
        </p>
        <p className="mt-8 font-mono text-[11px] text-graphite">
          {meta.author} ·{" "}
          <time dateTime={meta.date}>{longDate(meta.date)}</time>
        </p>
      </header>

      <PostCover cover={cover} />

      <div className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-5 py-16 sm:px-8 lg:py-20">
          {body(FACTS).map((block, i) =>
            block.kind === "h" ? (
              <h2
                key={block.id}
                id={block.id}
                className="mt-16 mb-6 scroll-mt-8 text-2xl/tight font-semibold tracking-[-0.02em] text-balance [font-stretch:112%]"
              >
                {block.text}
              </h2>
            ) : block.kind === "figure" ? (
              <PostFigure key={i} figure={block.figure} facts={FACTS} />
            ) : (
              <p
                key={i}
                className="mb-6 font-serif text-[19px]/[1.7] text-pretty text-ink/90"
              >
                <Inline text={block.text} />
              </p>
            )
          )}
        </div>
      </div>
    </article>
  )
}
