import { existsSync, statSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Metadata } from "next"
import Link from "next/link"
import { CopyField } from "@/components/install/copy-field"
import { PagePreview } from "@/components/install/page-preview"
import { PageIntro } from "@/components/page-intro"
import { Section } from "@/components/section"
import { buttonVariants } from "@/components/ui/button"
import { REPORT } from "@/lib/calibration"
import { readReleases } from "@/lib/changelog"
import { cn } from "@/lib/utils"

const ZIP = "slop-meter-chrome.zip"
const STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL
const falseMachinePer100 = Math.max(
  1,
  Math.round(REPORT.decision.web.machine * 100)
)

export const metadata: Metadata = {
  title: "Install",
  alternates: { canonical: "/install" },
  description:
    "Add Slop Meter to Chrome. It marks each paragraph you read with the odds that a model wrote it, and scores on your device.",
}

const PRIVACY = [
  {
    term: "Scoring",
    detail:
      "Runs inside the extension, for the marks, a selection you score, or text you paste into the popup. None of it is sent anywhere to be scored.",
  },
  {
    term: "Sharper reading",
    detail:
      "Off until you turn it on. It downloads a small language model, about 120\u00a0MB, from Hugging Face once, and runs it inside the extension. Your text isn't sent anywhere.",
  },
  {
    term: "Rewrite",
    detail:
      "Off until you turn it on. When you use it, that one paragraph goes to the Slop Meter server, which asks a model to rewrite it.",
  },
  {
    term: "Corrections",
    detail:
      "Off until you turn them on. Marking a call wrong then sends the numbers behind the mark, your label and a random install ID. Never the text.",
  },
  {
    term: "Where it runs",
    detail:
      "Every site except mail, document editors and banking, until you switch it on there. The toolbar button turns it off for one site or everywhere.",
  },
  {
    term: "Permissions",
    detail:
      "Chrome will say it can read and change data on the sites you visit. It needs that to read paragraphs and draw the marks. It also stores your settings.",
  },
]

export default async function InstallPage() {
  const zipPath = join(process.cwd(), "public", ZIP)
  const zipBytes = existsSync(zipPath) ? statSync(zipPath).size : null
  const { version } = JSON.parse(
    await readFile(join(process.cwd(), "../extension/package.json"), "utf8")
  ) as { version: string }
  const [latest] = await readReleases()

  return (
    <>
      <PageIntro label="Install" title="Add Slop Meter to Chrome">
        <p>
          It puts a small lamp beside each paragraph you read, colored by its
          best guess, and opens a card with the odds when you hover one. To
          check anything else, select it and choose Score with Slop Meter from
          the right-click menu, or paste it into the toolbar popup. The model
          runs inside the extension, so nothing you read is sent anywhere to be
          scored.
        </p>
        {/* Shown where the pointer is a finger: nothing below can be done there. */}
        <p className="mt-4 hidden text-ink pointer-coarse:block">
          The extension runs in Chrome on a computer. On a phone or tablet, use
          the{" "}
          <Link href="/#bench" className="underline">
            home page
          </Link>
          : paste text or open a document and it's read the same way.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          {STORE_URL ? (
            <a
              href={STORE_URL}
              className={cn(buttonVariants(), "h-10 rounded-full px-5 text-sm")}
            >
              Add to Chrome
            </a>
          ) : (
            zipBytes && (
              <a
                href={`/${ZIP}`}
                download
                className={cn(
                  buttonVariants(),
                  "h-10 rounded-full px-5 text-sm"
                )}
              >
                Download for Chrome
              </a>
            )
          )}
          <p className="font-mono text-[11px] text-graphite">
            Version {version}
            {zipBytes &&
              ` · ${(zipBytes / 1024 / 1024).toFixed(1)}\u00a0MB zip`}
          </p>
        </div>
      </PageIntro>

      <Section
        id="load"
        label={STORE_URL ? "Without the store" : "Load it"}
        title={
          STORE_URL
            ? "Or load it from a folder"
            : "Three steps, while it waits for the Chrome Web Store"
        }
        lead="Chrome can run an extension from a folder on your computer. It takes about a minute. Keep the folder where it is afterwards, because Chrome loads the extension from it each time."
      >
        <ol className="grid gap-x-10 gap-y-10 md:grid-cols-3">
          <Step n={1} title="Download and unzip">
            {zipBytes ? (
              <>
                Download{" "}
                <a
                  href={`/${ZIP}`}
                  download
                  className="text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink"
                >
                  {ZIP}
                </a>{" "}
                and unzip it somewhere you'll keep it.
              </>
            ) : (
              <>
                Build it from the repo with{" "}
                <code className="font-mono text-[13px] text-ink">
                  pnpm --filter @slop/extension zip
                </code>
                , then unzip the file it writes to{" "}
                <code className="font-mono text-[13px] text-ink">
                  apps/extension/.output
                </code>
                .
              </>
            )}
          </Step>
          <Step n={2} title="Turn on Developer mode">
            Paste <CopyField value="chrome://extensions" /> into the address
            bar, then turn on Developer mode in the top right corner.
          </Step>
          <Step n={3} title="Load the folder">
            Click Load unpacked and choose the unzipped folder. Pin Slop Meter
            from the puzzle-piece menu to see each page's summary.
          </Step>
        </ol>
      </Section>

      <Section
        id="preview"
        label="On a page"
        title="What you'll see"
        lead="A lamp beside each paragraph, colored like the dial: blue for human-ish, orange for machine-ish, brass for mixed, gray for can't tell. The fainter the lamp, the less sure it is. Hover or tab to a paragraph for the card."
      >
        <PagePreview />
      </Section>

      <Section
        id="privacy"
        label="Privacy"
        title="What leaves your device, and when"
        lead="Nothing, unless you turn on one of the three features that use the network."
      >
        <dl className="grid gap-x-16 border-t border-hairline sm:grid-cols-2">
          {PRIVACY.map((item) => (
            <div
              key={item.term}
              className="grid gap-1 border-b border-hairline py-5 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-6"
            >
              <dt className="legend pt-0.5 text-[10px] font-semibold">
                {item.term}
              </dt>
              <dd className="text-[15px]/relaxed text-pretty text-graphite">
                {item.detail}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-lg text-[15px]/relaxed text-pretty text-graphite">
          It won't give a page one score or say which model wrote something. On
          web pages from sites it never trained on, it calls about{" "}
          {falseMachinePer100} in 100 human paragraphs machine-ish, so don't use
          it to accuse anyone.
        </p>
      </Section>

      {latest && (
        <Section
          id="changes"
          label="Changelog"
          title={`This is version ${latest.version}`}
        >
          <p className="max-w-lg text-[15px]/relaxed text-pretty text-graphite">
            {latest.blocks.find((block) => block.kind === "paragraph")?.text}{" "}
            <Link href="/changelog" className="text-ink underline">
              Everything in each release
            </Link>
            .
          </p>
        </Section>
      )}
    </>
  )
}

function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="border-t border-ink pt-5">
      <p aria-hidden className="font-mono text-[11px] text-graphite">
        Step {n}
      </p>
      <h3 className="mt-3 text-lg/snug font-semibold text-balance">{title}</h3>
      <p className="mt-2 text-[15px]/relaxed text-pretty text-graphite">
        {children}
      </p>
    </li>
  )
}
