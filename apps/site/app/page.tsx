import manifest from "@slop/model/manifest.json"
import Link from "next/link"
import { connection } from "next/server"
import { EngineCheck } from "@/components/bench/engine-check"
import { ReadingBench } from "@/components/bench/reading-bench"
import { PageIntro } from "@/components/page-intro"
import { Section } from "@/components/section"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const kilobytes = Math.round(manifest.bytes / 1024)

export default async function Home() {
  await connection()
  return (
    <>
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
            href="/calibration"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-full border-hairline bg-transparent px-5 text-sm"
            )}
          >
            See how often it's right
          </Link>
        </div>
      </PageIntro>
      <ReadingBench />
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
