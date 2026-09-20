"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wordmark } from "@/components/brand"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/calibration", label: "Calibration" },
  { href: "/rules", label: "Rulebook" },
]

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="border-b border-hairline">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-8 px-5 sm:px-8"
      >
        <Link href="/" aria-label="Slop Meter, home">
          <Wordmark />
        </Link>
        <ul className="ml-auto flex items-center gap-6 text-sm">
          {LINKS.map(({ href, label }) => {
            const current = pathname.startsWith(href)
            return (
              <li key={href} className="max-sm:hidden">
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "text-graphite transition-colors hover:text-ink active:text-ink",
                    current && "text-ink"
                  )}
                >
                  {label}
                </Link>
              </li>
            )
          })}
          <li>
            <Link
              href="/install"
              className={cn(
                buttonVariants(),
                "h-9 rounded-full px-4 text-[13px]"
              )}
            >
              Add to Chrome
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}
