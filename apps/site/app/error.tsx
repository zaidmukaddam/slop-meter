"use client"

import Link from "next/link"
import { PageIntro } from "@/components/page-intro"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <>
      <PageIntro label="Error" title="Something broke on our side.">
        <p>
          This page hit an error while it loaded. It's our fault, not yours.
          Trying again usually works.
        </p>
      </PageIntro>
      <div className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-6 px-5 py-12 sm:px-8">
          <Button
            onClick={retry}
            className="h-10 rounded-full px-5 text-[13px]"
          >
            Try again
          </Button>
          <Link href="/" className="text-[15px] underline underline-offset-4">
            Go to the home page
          </Link>
          {error.digest && (
            <p className="font-mono text-[12px] text-graphite">
              Reference {error.digest}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
