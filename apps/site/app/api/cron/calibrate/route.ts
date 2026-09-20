import manifest from "@slop/model/manifest.json"
import { type FeedbackRow, calibrate } from "@/lib/server/calibrate"
import { sql } from "@/lib/server/db"

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 })
  if (!sql)
    return Response.json({ error: "DATABASE_URL is not set" }, { status: 503 })

  const rows = (await sql`
    select predicted, label, p, created_at
    from feedback
    where model_version = ${manifest.version}`) as FeedbackRow[]
  const snapshot = calibrate(rows)
  await sql`
    insert into calibration_snapshots (n, ece, bins, unsure_by_week, model_version)
    values (${snapshot.n}, ${snapshot.ece}, ${JSON.stringify(snapshot.bins)},
            ${JSON.stringify(snapshot.unsureByWeek)}, ${manifest.version})`
  return Response.json({ modelVersion: manifest.version, ...snapshot })
}
