import { percent as percentOf } from "@slop/model"

export function percent(x: number | null | undefined, digits = 0): string {
  if (x == null || !Number.isFinite(x)) return "–"
  return percentOf(x, digits)
}

export function decimal(x: number | null | undefined, digits = 3): string {
  if (x == null || !Number.isFinite(x)) return "–"
  return x.toFixed(digits)
}

export const integer = (n: number) => n.toLocaleString("en-US")

export const keepUnits = (text: string) =>
  text.replace(/(\d) (KB|MB|GB|ms)\b/g, "$1\u00a0$2")
