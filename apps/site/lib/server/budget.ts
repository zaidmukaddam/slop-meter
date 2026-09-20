import { sql } from "./db.ts"

export type Budget = {
  scope: string
  key: string
  period: string
  limit: number
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const memoryCounts = new Map<string, number>()

function spendInMemory(budgets: Budget[], calls: number): number[] {
  return budgets.map(({ scope, key, period }) => {
    const id = `${scope}|${key}|${period}`
    const next = (memoryCounts.get(id) ?? 0) + calls
    memoryCounts.set(id, next)
    return next
  })
}

type CountRow = { scope: string; key: string; count: number }

async function spendInPostgres(
  db: NonNullable<typeof sql>,
  budgets: Budget[],
  calls: number
): Promise<number[]> {
  const callsParam = `$${budgets.length * 3 + 1}`
  const rows = budgets.map((_, i) => {
    const base = i * 3
    return `($${base + 1}, $${base + 2}, $${base + 3}, ${callsParam})`
  })
  const params = budgets.flatMap((b) => [b.scope, b.key, b.period])
  const result = (await db.query(
    `insert into usage (scope, key, period, count) values ${rows.join(", ")}
     on conflict (scope, key, period)
     do update set count = usage.count + excluded.count
     returning scope, key, count`,
    [...params, calls]
  )) as CountRow[]
  return budgets.map((b) => {
    const row = result.find((r) => r.scope === b.scope && r.key === b.key)
    return row?.count ?? Infinity
  })
}

export async function spend(budgets: Budget[], calls: number) {
  const counts = sql
    ? await spendInPostgres(sql, budgets, calls)
    : spendInMemory(budgets, calls)
  return budgets.every((budget, i) => counts[i] <= budget.limit)
}
