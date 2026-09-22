import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { PageIntro } from "@/components/page-intro"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Finding, Group } from "@/lib/audit/checks"
import { type AuditResult, runAudit } from "@/lib/audit/run"
import { AuditError } from "@/lib/server/fetch-page"

const GROUPS: Group[] = [
  "Copy",
  "Type and icons",
  "Surfaces",
  "Colour",
  "Layout",
  "Trust",
]

export const metadata: Metadata = {
  title: "Site audit",
  alternates: { canonical: "/audit" },
  description:
    "Paste a web address and see which of the usual vibe-coded tells the page has: em dashes, Inter, purple gradients, glass cards, missing terms and more.",
}

type Result =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | ({ kind: "done" } & AuditResult)

async function run(input: string): Promise<Result> {
  try {
    return { kind: "done", ...(await runAudit(input, await headers())) }
  } catch (error) {
    if (error instanceof AuditError)
      return { kind: "error", message: error.message }
    throw error
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string | string[] }>
}) {
  const raw = (await searchParams).url
  const input = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ""
  const result: Result = input ? await run(input) : { kind: "empty" }

  return (
    <>
      <PageIntro label="Site audit" title="Does your site look vibe-coded?">
        <p>
          Paste an address. We fetch the page and its stylesheets and check them
          for the tells that give a generated site away, from em dashes and
          Inter to purple gradients and glass cards.
        </p>
      </PageIntro>

      <div className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8">
          <form action="/audit" method="get" className="flex max-w-2xl gap-3">
            <label htmlFor="url" className="sr-only">
              Web address
            </label>
            <Input
              id="url"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="example.com"
              defaultValue={input}
              required
              className="h-10 flex-1 rounded-full px-4 text-base md:text-[15px]"
            />
            <Button
              type="submit"
              className="h-10 rounded-full px-5 text-[13px]"
            >
              Audit
            </Button>
          </form>

          {result.kind === "error" && (
            <p
              role="alert"
              className="mt-6 max-w-2xl text-[15px] text-pretty text-graphite"
            >
              {result.message}
            </p>
          )}

          {result.kind === "done" && <Report {...result} />}
        </div>
      </div>
    </>
  )
}

function Report({
  url,
  findings,
  thin,
}: {
  url: string
  findings: Finding[]
  thin: boolean
}) {
  const hits = findings.filter((f) => f.hit).length
  const host = new URL(url).hostname
  return (
    <section aria-labelledby="report-title" className="mt-14">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-8">
        <div>
          <p className="legend text-[10px] font-semibold text-graphite">
            {host}
          </p>
          <h2
            id="report-title"
            className="mt-3 font-mono text-[3rem] leading-none font-light tracking-tight tabular-nums"
          >
            {hits} <span className="text-graphite">of {findings.length}</span>
          </h2>
          <p className="mt-3 text-[15px] text-graphite">
            tells found on this page
          </p>
        </div>
        <p className="max-w-sm text-sm/relaxed text-pretty text-graphite">
          {thin
            ? "Most of this page is drawn by JavaScript, so we only saw part of it. The count is a floor."
            : "Read from the HTML and CSS the site sends. A tell is a habit, not a verdict."}
        </p>
      </header>

      <div className="grid gap-x-16 gap-y-12 pt-10 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group}>
            <h3 className="legend mb-4 text-[10px] font-semibold text-graphite">
              {group}
            </h3>
            <ul className="divide-y divide-hairline">
              {findings
                .filter((f) => f.group === group)
                .sort((a, b) => Number(b.hit) - Number(a.hit))
                .map((f) => (
                  <li key={f.id} className="flex gap-3 py-3">
                    <span
                      aria-hidden
                      className="mt-2 size-2 shrink-0 rounded-full"
                      style={{
                        background: f.hit
                          ? "var(--machine)"
                          : "var(--hairline)",
                      }}
                    />
                    <div className="min-w-0">
                      <p className={f.hit ? "font-medium" : "text-graphite"}>
                        <span className="sr-only">
                          {f.hit ? "Found: " : "Not found: "}
                        </span>
                        {f.title}
                      </p>
                      {f.hit && (
                        <p className="mt-0.5 font-mono text-[12px] break-words text-graphite">
                          {f.evidence}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-12 max-w-2xl text-sm/relaxed text-pretty text-graphite">
        The copy check runs Slop Meter&apos;s own model on the page&apos;s
        paragraphs. The rest are pattern checks. Fake testimonials, missing
        loading states and whether there&apos;s a real product demo can&apos;t
        be read from markup, so they aren&apos;t counted. The same report comes
        as JSON from{" "}
        <code className="font-mono text-[13px] text-ink">
          GET /api/audit?url={host}
        </code>
        . We don&apos;t keep the page. See the{" "}
        <Link href="/privacy" className="underline">
          privacy page
        </Link>
        .
      </p>
    </section>
  )
}
