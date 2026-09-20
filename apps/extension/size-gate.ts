import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const BUDGET = 120 * 1024
const out = join(import.meta.dirname, ".output/chrome-mv3")
if (!existsSync(join(out, "content-scripts"))) {
  console.error(
    `no build at ${out}: run pnpm --filter @slop/extension build first`
  )
  process.exit(1)
}
const files = [
  ...readdirSync(join(out, "content-scripts")).map(
    (f) => `content-scripts/${f}`
  ),
  "model.bin",
]
let total = 0
for (const f of files) {
  const n = statSync(join(out, f)).size
  total += n
  console.log(`${f.padEnd(34)} ${n.toLocaleString("en").padStart(9)} B`)
}
const pct = ((100 * total) / BUDGET).toFixed(1)
console.log(
  `${"total".padEnd(34)} ${total.toLocaleString("en").padStart(9)} B  of ${BUDGET.toLocaleString("en")} B (${pct}%)`
)
if (total > BUDGET) {
  console.error(`over budget by ${(total - BUDGET).toLocaleString("en")} B`)
  process.exit(1)
}
