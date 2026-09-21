import type { Decision, Reason, Score } from "./index.ts"

export const DECISIONS = ["human", "machine", "mixed", "unsure"] as const

export const DIAL_ORDER = ["human", "mixed", "machine"] as const

export const DECISION_LABEL: Record<Decision, string> = {
  human: "human-ish",
  machine: "machine-ish",
  mixed: "mixed",
  unsure: "can't tell",
}

export const RULE_FIRED = 0.05

export const isRead = (score: Score) => !score.tooShort && !score.notEnglish

export const shownP = (p: number) => Math.min(p, 0.99)

export const percent = (p: number, digits = 0) =>
  `${(p * 100).toFixed(digits)}%`

export function cardNote(score: Score): string {
  return score.localDecision === "unsure"
    ? `Leans ${DECISION_LABEL[score.top]} at ${percent(score.localP)}. It needs ${percent(score.bar)} to call it.`
    : `At this confidence it's right about ${percent(shownP(score.localP))} of the time on held-out text.`
}

export const reasonCode = (reason: Reason) =>
  reason.value > RULE_FIRED ? reason.id : `absent · ${reason.id}`
