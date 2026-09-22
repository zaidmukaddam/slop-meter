import { spend, today } from "@/lib/server/budget"
import { AuditError, fetchPage } from "@/lib/server/fetch-page"
import { hashedIp } from "@/lib/server/http"
import { type Finding, audit } from "./checks"
import { copyFinding } from "./copy"

const PER_IP_PER_DAY = 30

export type AuditResult = { url: string; findings: Finding[]; thin: boolean }

export async function runAudit(
  input: string,
  headers: Headers
): Promise<AuditResult> {
  const budget = {
    scope: "audit-ip",
    key: hashedIp(headers),
    period: today(),
    limit: PER_IP_PER_DAY,
  }
  if (!(await spend([budget], 1))) {
    throw new AuditError(
      "That's today's limit of audits from here. Try again tomorrow.",
      429
    )
  }
  const page = await fetchPage(input)
  const findings = [await copyFinding(page.html), ...audit(page)]
  const thin =
    page.html.replace(/<script\b[\s\S]*?<\/script>/gi, "").length < 3000
  return { url: page.url, findings, thin }
}
