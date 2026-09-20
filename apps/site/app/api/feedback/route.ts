import { type Correction, isCorrection } from "@slop/model"
import { sql } from "@/lib/server/db"
import { isUuid, json, preflight, readJson } from "@/lib/server/http"

const MAX_ITEMS = 50
const MAX_BODY_CHARS = 400_000

export const OPTIONS = preflight

type FeedbackRequest = { installId: string; items: Correction[] }

function parseRequest(body: unknown): FeedbackRequest | null {
  const { installId, items } = (body ?? {}) as Record<string, unknown>
  if (!isUuid(installId) || !Array.isArray(items)) return null
  if (items.length < 1 || items.length > MAX_ITEMS) return null
  return items.every(isCorrection) ? { installId, items } : null
}

export async function POST(request: Request) {
  const db = sql
  if (!db) return json({ error: "feedback storage is not configured" }, 503)

  const parsed = parseRequest(await readJson(request, MAX_BODY_CHARS))
  if (!parsed) {
    return json(
      { error: "body must be {installId, items: FeedbackItem[]}, 1-50 items" },
      400
    )
  }
  const inserts = parsed.items.map(
    (item) => db`
      insert into feedback
        (install_id, vector, predicted, label, p, site_class, spec, model_version)
      values
        (${parsed.installId}, ${item.vector}, ${item.predicted}, ${item.label},
         ${item.p}, ${item.siteClass}, ${item.spec}, ${item.modelVersion})`
  )
  await db.transaction(inserts)
  return json({ stored: parsed.items.length })
}
