"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface OwnTextEditorProps {
  value: string
  onChange: (text: string) => void
  onRead: () => void
}

export function OwnTextEditor({ value, onChange, onRead }: OwnTextEditorProps) {
  const words = value.match(/\S+/g)?.length ?? 0
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim()) onRead()
      }}
    >
      <Textarea
        aria-label="Your text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPaste={() => {
          if (!value.trim()) onRead()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.currentTarget.form?.requestSubmit()
          }
        }}
        placeholder="Paste some writing here."
        className="min-h-72 max-w-(--measure) resize-y rounded-none border-0 bg-transparent p-0 font-serif text-[18px]/[1.7] shadow-none focus-visible:ring-0 md:text-[18px]/[1.7] dark:bg-transparent"
      />
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-hairline pt-4">
        <p className="font-mono text-[11px] text-graphite tabular-nums">
          {words} {words === 1 ? "word" : "words"}
        </p>
        <Button
          type="submit"
          disabled={!value.trim()}
          className="h-9 rounded-full px-4"
        >
          Read it
        </Button>
      </div>
    </form>
  )
}
