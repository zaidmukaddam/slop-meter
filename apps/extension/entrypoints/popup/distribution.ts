import { DECISION_LABEL, type Decision } from "@slop/model"

export type Share = {
  decision: Decision
  name: string
  color: string
  percent: number
}

const ORDER: Decision[] = ["machine", "mixed", "unsure", "human"]

export function distribution(counts: Record<Decision, number>): Share[] {
  const total = totalScored(counts)
  if (total === 0) return []

  const shares = ORDER.map((decision) => {
    const exact = (100 * counts[decision]) / total
    return {
      decision,
      name: DECISION_LABEL[decision],
      color: `var(--${decision})`,
      exact,
      percent: Math.floor(exact),
    }
  })
  const floored = shares.reduce((sum, share) => sum + share.percent, 0)
  const byRemainder = [...shares].sort((a, b) => (b.exact % 1) - (a.exact % 1))
  byRemainder.slice(0, 100 - floored).forEach((share) => share.percent++)

  return shares
    .filter((share) => counts[share.decision] > 0)
    .sort((a, b) => b.percent - a.percent)
    .map(({ exact: _exact, ...share }) => share)
}

export function totalScored(counts: Record<Decision, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}
