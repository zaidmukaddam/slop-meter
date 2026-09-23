"use client"

import "./globals.css"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <title>Something broke · Slop Meter</title>
        <main className="mx-auto w-full max-w-[1200px] px-5 pt-16 sm:px-8">
          <p className="legend text-[10px] font-semibold text-graphite">
            Slop Meter
          </p>
          <h1 className="mt-5 text-[2.6rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance [font-stretch:112%] sm:text-[3.6rem]">
            Something broke on our side.
          </h1>
          <p className="mt-6 max-w-xl text-[17px]/relaxed text-pretty text-graphite">
            The site hit an error before it could load. Trying again usually
            works.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Button
              onClick={retry}
              className="h-10 rounded-full px-5 text-[13px]"
            >
              Try again
            </Button>
            {error.digest && (
              <p className="font-mono text-[12px] text-graphite">
                Reference {error.digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  )
}
