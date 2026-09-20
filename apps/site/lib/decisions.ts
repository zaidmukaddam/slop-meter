import type { Decision, Score } from "@slop/model"

export const machineShare = (score: Score) =>
  score.probs.machine + score.probs.mixed / 2

export const COLOR: Record<Decision, string> = {
  human: "var(--human)",
  machine: "var(--machine)",
  mixed: "var(--mixed)",
  unsure: "var(--unsure)",
}

const COIN_FLIP = 1 / 3

export function confidenceOpacity(p: number): number {
  const confidence = (p - COIN_FLIP) / (1 - COIN_FLIP)
  return 0.2 + 0.8 * Math.min(1, Math.max(0, confidence))
}
