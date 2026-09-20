import manifest from "@slop/model/manifest.json"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { EngineCheck } from "@/components/bench/engine-check"
import { ReadingBench } from "@/components/bench/reading-bench"
import { PageIntro } from "@/components/page-intro"
import { Section } from "@/components/section"
import { buttonVariants } from "@/components/ui/button"
import { MODEL_FACTS } from "@/lib/models"
import { cn } from "@/lib/utils"

const kilobytes = Math.round(manifest.bytes / 1024)

export const metadata: Metadata = {
  title: {
    absolute: "Slop Meter: see which paragraphs read like a model wrote them",
  },
  alternates: { canonical: "/" },
}

const LINKED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Slop Meter",
      url: "https://slop-meter.com",
      description:
        "Marks each paragraph human-ish, machine-ish, mixed or can't tell, with the odds. The model runs in your browser.",
    },
    {
      "@type": "SoftwareApplication",
      name: "Slop Meter",
      applicationCategory: "BrowserApplication",
      operatingSystem: "Chrome",
      url: "https://slop-meter.com/install",
      image: "https://slop-meter.com/opengraph-image.png",
      description:
        "A Chrome extension that marks each paragraph on a page human-ish, machine-ish, mixed or can't tell. It scores on your device and sends no text anywhere.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
}

export default async function Home() {
  await connection()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LINKED_DATA) }}
      />
      <PageIntro
        title={
          <>
            See which paragraphs read like{" "}
            <span className="text-machine">a model</span> wrote them.
          </>
        }
      >
        <p>
          Every paragraph gets marked human-ish, machine-ish or mixed, with the
          odds. When the evidence is thin, the meter says it can't tell, and it
          says that a lot, on purpose. The model is {kilobytes}&nbsp;KB and runs
          in your browser, so nothing you paste gets uploaded.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/install"
            className={cn(buttonVariants(), "h-10 rounded-full px-5 text-sm")}
          >
            Add to Chrome
          </Link>
          <Link
            href="/models"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-full border-hairline bg-transparent px-5 text-sm"
            )}
          >
            See how often it's right
          </Link>
        </div>
      </PageIntro>
      <ReadingBench models={MODEL_FACTS} />
      <Section
        id="engine"
        label="Engine"
        title="Test WebGPU on this device"
        lead="The sheet above scores each paragraph on the CPU, in well under a millisecond. WebGPU takes over for big batches, like a long page in the extension. This test runs both here and checks that they agree."
      >
        <EngineCheck />
      </Section>
    </>
  )
}
