export type Verdict = "human" | "machine" | "mixed" | "unsure"

export type Label = "human-ish" | "machine-ish" | "mixed" | "can't tell"

export type Reason = {
  id: string
  name: string
  spans: [start: number, end: number][]
}

export type Reading = {
  text: string
  words: number
  verdict: Verdict
  label: Label
  confidence: number
  probabilities: { human: number; machine: number; mixed: number }
  reasons: Reason[]
  skipped: "too-short" | "not-english" | null
}

export declare const version: string

export declare function score(paragraph: string): Promise<Reading>

export declare function scoreText(text: string): Promise<Reading[]>
