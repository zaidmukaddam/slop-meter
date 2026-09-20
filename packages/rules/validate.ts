import { readFileSync, writeFileSync } from "node:fs"
import { parse } from "yaml"

export const TIERS = [
  "lexical",
  "punctuation",
  "statistical",
  "structural",
  "semantic",
] as const
const FIELDS = ["id", "name", "tier", "detect", "fix", "weight"] as const
const ID = /^r-\d{3}$/

export function validate(rules: unknown): string[] {
  if (!Array.isArray(rules)) return ["rulebook must be a list"]
  const errors: string[] = []
  const seen = new Set<unknown>()

  rules.forEach((rule: Record<string, unknown> | null, i) => {
    const entry = rule ?? {}
    const where = `entry ${i} (${entry.id ?? "?"})`

    for (const field of FIELDS) {
      const value = entry[field]
      if (typeof value !== "string" || !value.trim()) {
        errors.push(`${where}: missing ${field}`)
      }
    }
    if (typeof entry.id === "string" && !ID.test(entry.id)) {
      errors.push(`${where}: id must look like r-000`)
    }
    if (seen.has(entry.id)) errors.push(`${where}: duplicate id`)
    seen.add(entry.id)
    if (entry.tier && !(TIERS as readonly unknown[]).includes(entry.tier)) {
      errors.push(`${where}: tier must be one of ${TIERS.join(", ")}`)
    }
    if ("example" in entry) {
      const example = (entry.example ?? {}) as Record<string, unknown>
      for (const part of ["tell", "plain"]) {
        if (typeof example[part] !== "string" || !example[part].trim()) {
          errors.push(`${where}: example needs ${part}`)
        }
      }
    }
    const unknown = Object.keys(entry).filter(
      (key) => key !== "example" && !(FIELDS as readonly string[]).includes(key)
    )
    if (unknown.length) {
      errors.push(`${where}: unknown fields ${unknown.join(", ")}`)
    }
  })
  return errors
}

if (import.meta.main) {
  const dir = new URL(".", import.meta.url)
  const rules = parse(readFileSync(new URL("rulebook.yaml", dir), "utf8"))
  const errors = validate(rules)
  if (errors.length) {
    console.error(errors.join("\n"))
    process.exit(1)
  }
  writeFileSync(
    new URL("rules.json", dir),
    JSON.stringify(rules, null, 2) + "\n"
  )
  const names = Object.fromEntries(
    rules.map((r: { id: string; name: string; tier: string }) => [
      r.id,
      { name: r.name, tier: r.tier },
    ])
  )
  writeFileSync(
    new URL("names.json", dir),
    JSON.stringify(names, null, 2) + "\n"
  )
  console.log(`rulebook ok: ${rules.length} rules`)
}
