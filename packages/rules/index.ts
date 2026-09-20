import rules from "./rules.json" with { type: "json" }

export type Tier =
  "lexical" | "punctuation" | "statistical" | "structural" | "semantic"
export type Rule = {
  id: string
  name: string
  tier: Tier
  detect: string
  fix: string
  weight: string
  example?: { tell: string; plain: string }
}

export const RULES = rules as Rule[]
export const RULE_BY_ID: Record<string, Rule> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule])
)

export function rewriteInstructions(focus: string[] = []): string {
  const rulebook = RULES.map(
    (r) => `${r.id} ${r.name}: ${r.detect}. Fix: ${r.fix}.`
  ).join("\n")
  const priorities = focus.length
    ? `\nThese rules fired on this paragraph, fix them first: ${focus.join(", ")}.`
    : ""
  return `You rewrite one paragraph so it stops reading as machine-generated, without changing its meaning, facts, or length by more than 20%.
Remove the tells below. Do not add facts, opinions, or first-person claims the author did not make.${priorities}

Rulebook:
${rulebook}

Output format: the rewritten paragraph, then a blank line, then one line starting "Removed:" listing the rule ids you fixed, comma-separated.`
}
