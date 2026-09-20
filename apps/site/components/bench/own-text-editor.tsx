"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DOCUMENT_TYPES, readDocument } from "@/lib/document"
import { cn } from "@/lib/utils"

interface OwnTextEditorProps {
  value: string
  onChange: (text: string) => void
  onRead: () => void
}

export function OwnTextEditor({ value, onChange, onRead }: OwnTextEditorProps) {
  const words = value.match(/\S+/g)?.length ?? 0
  const fileInput = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [reading, setReading] = useState("")
  const [problem, setProblem] = useState("")

  async function take(file: File | undefined) {
    if (!file) return
    setProblem("")
    setReading(file.name)
    try {
      const text = await readDocument(file)
      onChange(text)
      onRead()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setReading("")
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim()) onRead()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        void take(event.dataTransfer.files[0])
      }}
      className={cn(
        "rounded-md transition-colors",
        over && "bg-marker/15 outline-2 outline-offset-8 outline-etch"
      )}
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
        placeholder="Paste some writing here, or drop in a document."
        className="min-h-72 max-w-(--measure) resize-y rounded-none border-0 bg-transparent p-0 font-serif text-[18px]/[1.7] shadow-none focus-visible:ring-0 md:text-[18px]/[1.7] dark:bg-transparent"
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-hairline pt-4">
        <p
          aria-live="polite"
          className={cn(
            "font-mono text-[11px] tabular-nums",
            problem ? "text-destructive" : "text-graphite"
          )}
        >
          {problem ||
            (reading
              ? `Reading ${reading}…`
              : `${words} ${words === 1 ? "word" : "words"}`)}
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept={DOCUMENT_TYPES}
            className="sr-only"
            onChange={(event) => {
              void take(event.target.files?.[0])
              event.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            className="h-9 rounded-full border-hairline bg-transparent px-4"
          >
            Open a document
          </Button>
          <Button
            type="submit"
            disabled={!value.trim()}
            className="h-9 rounded-full px-4"
          >
            Read it
          </Button>
        </div>
      </div>
    </form>
  )
}
