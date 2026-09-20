import { neon } from "@neondatabase/serverless"
import { SPEC_VERSION } from "@slop/features"

const sql = neon(process.env.DATABASE_URL!)
const rows =
  await sql`select vector, label, created_at from feedback where spec = ${SPEC_VERSION} and label <> 'unsure' order by created_at`
for (const r of rows)
  process.stdout.write(
    JSON.stringify({
      vector: r.vector,
      label: r.label,
      created_at: r.created_at,
    }) + "\n"
  )
console.error(`${rows.length} feedback rows (spec ${SPEC_VERSION})`)
