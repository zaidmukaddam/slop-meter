"use client"

import { CheckIcon, CopyIcon } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full border border-hairline bg-sheet pr-1 pl-3.5 align-middle">
      <code className="font-mono text-[13px]">{value}</code>
      <Button
        variant="ghost"
        size="icon"
        aria-label={copied ? "Copied" : `Copy ${value}`}
        onClick={() =>
          navigator.clipboard.writeText(value).then(() => setCopied(true))
        }
        className="size-7 rounded-full"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </span>
  )
}
