import { runAudit } from "@/lib/audit/run"
import { AuditError } from "@/lib/server/fetch-page"
import { json, preflight } from "@/lib/server/http"

export const OPTIONS = preflight

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("url")?.trim()
  if (!input) {
    return json({ error: "add ?url= with the address to audit" }, 400)
  }
  try {
    const { url, findings, thin } = await runAudit(input, request.headers)
    return json({
      url,
      found: findings.filter((f) => f.hit).length,
      total: findings.length,
      partial: thin,
      findings,
    })
  } catch (error) {
    if (error instanceof AuditError) {
      return json({ error: error.message }, error.status)
    }
    throw error
  }
}
