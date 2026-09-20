import { CLASSES, type ModelClass } from "@slop/model"

export type Bin = {
  bin: number
  predicted: number
  observed: number
  n: number
}
export type Reliability = Record<ModelClass, Bin[]>
export type WeekRate = { week: string; n: number; unsureRate: number }
export type FeedbackRow = {
  predicted: string
  label: string
  p: number
  created_at: Date | string
}

const BINS = 10
const DAY_MS = 86_400_000

export function isoWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const weekday = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday)
  const year = d.getUTCFullYear()
  const dayOfYear = (d.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1
  const week = Math.ceil(dayOfYear / 7)
  return `${year}-W${String(week).padStart(2, "0")}`
}

function isModelClass(value: string): value is ModelClass {
  return (CLASSES as readonly string[]).includes(value)
}

function reliability(rows: FeedbackRow[]): Reliability {
  const empty = () =>
    Array.from({ length: BINS }, () => ({ sumP: 0, agreed: 0, n: 0 }))
  const acc = { human: empty(), machine: empty(), mixed: empty() }
  for (const row of rows) {
    if (!isModelClass(row.predicted)) continue
    const bin = acc[row.predicted][Math.min(BINS - 1, Math.floor(row.p * BINS))]
    bin.sumP += row.p
    bin.agreed += row.label === row.predicted ? 1 : 0
    bin.n += 1
  }
  const toBins = (cells: ReturnType<typeof empty>): Bin[] =>
    cells.flatMap((cell, bin) =>
      cell.n
        ? [
            {
              bin,
              predicted: cell.sumP / cell.n,
              observed: cell.agreed / cell.n,
              n: cell.n,
            },
          ]
        : []
    )
  return {
    human: toBins(acc.human),
    machine: toBins(acc.machine),
    mixed: toBins(acc.mixed),
  }
}

function expectedCalibrationError(bins: Reliability): number | null {
  const all = Object.values(bins).flat()
  const n = all.reduce((sum, b) => sum + b.n, 0)
  if (!n) return null
  const gap = all.reduce(
    (sum, b) => sum + b.n * Math.abs(b.predicted - b.observed),
    0
  )
  return gap / n
}

function unsureByWeek(rows: FeedbackRow[]): WeekRate[] {
  const weeks = new Map<string, { n: number; unsure: number }>()
  for (const row of rows) {
    const week = isoWeek(new Date(row.created_at))
    const tally = weeks.get(week) ?? { n: 0, unsure: 0 }
    tally.n += 1
    tally.unsure += row.predicted === "unsure" ? 1 : 0
    weeks.set(week, tally)
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { n, unsure }]) => ({ week, n, unsureRate: unsure / n }))
}

export function calibrate(rows: FeedbackRow[]) {
  const bins = reliability(rows)
  return {
    n: rows.length,
    ece: expectedCalibrationError(bins),
    bins,
    unsureByWeek: unsureByWeek(rows),
  }
}
