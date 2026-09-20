import { BrandMark } from "@slop/theme/brand-mark"
import { cn } from "@/lib/utils"

export { BrandMark }

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="size-5" />
      <span className="legend text-[13px] font-semibold tracking-[0.14em]">
        Slop Meter
      </span>
    </span>
  )
}
