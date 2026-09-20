import examples from "@slop/eval/examples.json"

export type Example = (typeof examples)[number]

export const EXAMPLES: Example[] = examples
export const OWN_TEXT = "yours"

export const TEXT_GROUPS: { label: string; ids: string[] }[] = [
  { label: "A model wrote it", kind: "machine" },
  { label: "A person wrote it", kind: "human" },
  { label: "Both", kind: "mixed" },
]
  .map(({ label, kind }) => ({
    label,
    ids: EXAMPLES.filter((e) => e.expect === kind).map((e) => e.id),
  }))
  .concat({ label: "Yours", ids: [OWN_TEXT] })

export const TEXT_IDS = TEXT_GROUPS.flatMap((group) => group.ids)

export const EXAMPLE_LABELS: Record<string, string> = {
  "machine-copy": "Luna product copy",
  "machine-advice": "Qwen advice",
  "machine-recipe": "Gemini blog post",
  "machine-explainer": "Ministral explainer",
  "machine-reply": "Luna reply",
  "machine-essay": "DeepSeek essay",
  "human-wiki": "Wikipedia, 2020",
  "human-essay": "Thoreau, 1862",
  "press-release": "Fed press release",
  hybrid: "Thoreau, polished",
  [OWN_TEXT]: "Your text",
}
