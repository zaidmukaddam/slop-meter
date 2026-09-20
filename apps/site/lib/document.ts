"use client"

const MAX_BYTES = 20 * 1024 * 1024

export const DOCUMENT_TYPES =
  ".doc,.docx,.odt,.pdf,.ppt,.pptx,.rtf,.epub,.xlsx,.ods,.odp,.csv,.txt,.md"

const MESSAGES: Record<string, string> = {
  unsupported: "That file type can't be read here.",
  needsOcr: "This PDF is scanned, so it holds pictures of text, not text.",
  malformed: "That file is damaged, or holds no text to read.",
  encrypted: "That file is password-protected.",
  resourceLimit: "That file is too deeply nested to read safely.",
}

const isPlainText = (file: File) =>
  file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(file.name)

/** Markdown from the converter, minus the parts that aren't prose to score. */
function prose(markdown: string): string {
  return markdown
    .replace(/^ {0,3}(?:```|~~~)[\s\S]*?(?:```|~~~)\s*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Reads a document in the browser. The bytes go to WebAssembly on this
 * machine, never to a server.
 */
export async function readDocument(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("That file is over 20 MB.")
  }
  if (isPlainText(file)) return prose(await file.text())

  const bytes = new Uint8Array(await file.arrayBuffer())
  const anydoc = await import("@firecrawl/anydoc-wasm")
  await anydoc.default()
  try {
    const text = prose(anydoc.toMarkdownBytes(bytes))
    if (!text) throw new Error(MESSAGES.malformed)
    return text
  } catch (error) {
    const code = (error as { code?: string }).code
    throw new Error(
      (code && MESSAGES[code]) ||
        (error instanceof Error ? error.message : MESSAGES.malformed)
    )
  }
}
