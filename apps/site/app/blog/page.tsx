import type { Metadata } from "next"
import Link from "next/link"
import { PageIntro } from "@/components/page-intro"
import { POSTS, longDate } from "@/lib/posts"

export const metadata: Metadata = {
  title: "Blog",
  alternates: { canonical: "/blog" },
  description: "Notes on Slop Meter: what it does and what it gets wrong.",
}

export default function BlogPage() {
  return (
    <>
      <PageIntro label="Blog" title="Notes">
        <p>
          What the meter does and what it gets wrong. Release by release detail
          is in the{" "}
          <Link href="/changelog" className="text-ink underline">
            changelog
          </Link>
          .
        </p>
      </PageIntro>

      <div className="border-t border-hairline">
        <ol className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          {POSTS.map((post) => (
            <li
              key={post.slug}
              className="border-b border-hairline last:border-b-0"
            >
              <Link
                href={`/blog/${post.slug}`}
                className="group grid gap-x-16 gap-y-4 py-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-16"
              >
                <p className="legend pt-2 text-[10px] font-semibold text-graphite">
                  <time dateTime={post.date}>{longDate(post.date)}</time>
                </p>
                <div className="max-w-2xl">
                  <h2 className="text-3xl/tight font-semibold tracking-[-0.02em] text-balance [font-stretch:112%] underline-offset-4 group-hover:underline">
                    {post.title}
                  </h2>
                  <p className="mt-4 text-[17px]/relaxed text-pretty text-graphite">
                    {post.dek}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
