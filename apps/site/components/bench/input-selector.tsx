"use client"

import type { Decision } from "@slop/model"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { COLOR } from "@/lib/decisions"
import { EXAMPLE_LABELS, TEXT_GROUPS } from "@/lib/examples"
import { cn } from "@/lib/utils"

export type Fingerprint = { words: number; decision: Decision }[]

interface InputSelectorProps {
  value: string
  onValueChange: (id: string) => void
  fingerprints: Record<string, Fingerprint | undefined>
  className?: string
}

export function InputSelector({
  value,
  onValueChange,
  fingerprints,
  className,
}: InputSelectorProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(id) => onValueChange(String(id))}
      aria-label="Text to read"
      className={cn(
        "grid-cols-2 items-start gap-x-8 gap-y-6 sm:grid-cols-4",
        className
      )}
    >
      {TEXT_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="legend mb-2 text-[10px] font-semibold text-graphite">
            {group.label}
          </p>
          {group.ids.map((id) => {
            const selected = id === value
            return (
              <label
                key={id}
                className={cn(
                  "-mx-2 grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-md px-2 py-1.5 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/40",
                  selected
                    ? "text-ink"
                    : "text-graphite hover:text-ink active:text-ink"
                )}
              >
                <RadioGroupItem
                  value={id}
                  className="size-2.5 border-etch bg-transparent focus-visible:ring-0 dark:bg-transparent data-checked:border-ink data-checked:bg-ink dark:data-checked:bg-ink [&_[data-slot=radio-group-indicator]]:hidden"
                />
                <span className={cn("truncate", selected && "font-medium")}>
                  {EXAMPLE_LABELS[id]}
                </span>
                <FingerprintStrip print={fingerprints[id]} />
              </label>
            )
          })}
        </div>
      ))}
    </RadioGroup>
  )
}

function FingerprintStrip({ print }: { print: Fingerprint | undefined }) {
  return (
    <span
      aria-hidden
      className={cn(
        "col-start-2 flex h-1.5 w-16 shrink-0 gap-px overflow-hidden rounded-[1px]",
        !print?.length && "border border-dashed border-etch"
      )}
    >
      {print?.map((segment, i) => (
        <span
          key={i}
          style={{
            flexGrow: segment.words,
            background: COLOR[segment.decision],
          }}
        />
      ))}
    </span>
  )
}
