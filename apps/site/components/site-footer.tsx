import Link from "next/link"
import { Wordmark } from "@/components/brand"

const SOURCE_URL = process.env.NEXT_PUBLIC_SOURCE_URL

export function SiteFooter({ modelVersion }: { modelVersion: string }) {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-5 py-10 text-sm sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-sm text-pretty text-graphite">
            A machine-ish mark is a guess about style. It can't tell you who
            wrote something.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-graphite sm:items-end">
          <div className="flex gap-5">
            <Link href="/calibration" className="hover:text-ink">
              Calibration
            </Link>
            <Link href="/rules" className="hover:text-ink">
              Rulebook
            </Link>
            <Link href="/install" className="hover:text-ink">
              Install
            </Link>
            {SOURCE_URL && (
              <a href={SOURCE_URL} className="hover:text-ink">
                Source
              </a>
            )}
          </div>
          <p className="font-mono text-[11px]">Model {modelVersion}</p>
        </div>
      </div>
    </footer>
  )
}
