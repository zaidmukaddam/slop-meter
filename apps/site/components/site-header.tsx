"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wordmark } from "@/components/brand"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/models", label: "Models" },
  { href: "/rules", label: "Rulebook" },
  { href: "/blog", label: "Blog" },
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
        <ul className="ml-auto flex items-center gap-1 text-sm sm:gap-6">
          {LINKS.map(({ href, label }) => {
            const current = pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center px-2.5 text-graphite transition-colors hover:text-ink active:text-ink sm:h-auto sm:px-0",
                    current && "text-ink"
                  )}
                >
                  {label}
                </Link>
              </li>
            )
          })}
          <li className="max-sm:hidden">
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
