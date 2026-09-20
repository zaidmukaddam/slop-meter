import { FEATURE_NAMES } from "@slop/features"
import type { Decision } from "./index.ts"
import { CLASSES, type ModelClass } from "./weights.ts"
import { DECISIONS } from "./words.ts"

export const SITE_CLASSES = [
  "news",
  "blog",
  "forum",
  "social",
  "reference",
  "shop",
  "docs",
  "other",
] as const
export type SiteClass = (typeof SITE_CLASSES)[number]

export type Correction = {
  vector: number[]
  predicted: Decision
  label: ModelClass
  p: number
  siteClass: SiteClass
  spec: number
  modelVersion: string
}

const KEYS = "label,modelVersion,p,predicted,siteClass,spec,vector"
const MODEL_VERSION = /^[\w.-]{1,32}$/

const isOneOf = (list: readonly string[], value: unknown) =>
  typeof value === "string" && list.includes(value)

export function isCorrection(value: unknown): value is Correction {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  const { vector, p } = item
  return (
    Object.keys(item).sort().join() === KEYS &&
    Array.isArray(vector) &&
    vector.length === FEATURE_NAMES.length &&
    vector.every((v) => typeof v === "number" && Number.isFinite(v)) &&
    isOneOf(DECISIONS, item.predicted) &&
    isOneOf(CLASSES, item.label) &&
    typeof p === "number" &&
    p >= 0 &&
    p <= 1 &&
    isOneOf(SITE_CLASSES, item.siteClass) &&
    Number.isInteger(item.spec) &&
    typeof item.modelVersion === "string" &&
    MODEL_VERSION.test(item.modelVersion)
  )
}
