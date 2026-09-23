import type { Metadata } from "next"
import Link from "next/link"
import { PageIntro } from "@/components/page-intro"

export const metadata: Metadata = {
  title: "Not found",
}

const PLACES = [
  { href: "/", label: "Score some text" },
  { href: "/models", label: "The models" },
  { href: "/rules", label: "The rulebook" },
  { href: "/audit", label: "Audit a site" },
]

export default function NotFound() {
  return (
    <>
      <PageIntro label="404" title="Can't tell.">
        <p>
          There's nothing at this address to read, so the meter has no call to
          make. The link may be old, or the page may have moved.
        </p>
      </PageIntro>
      <div className="border-t border-hairline">
        <nav
          aria-label="Places to go"
          className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-x-8 gap-y-3 px-5 py-12 text-[15px] sm:px-8"
        >
          {PLACES.map((place) => (
            <Link
              key={place.href}
              href={place.href}
              className="underline underline-offset-4 hover:text-graphite"
            >
              {place.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
