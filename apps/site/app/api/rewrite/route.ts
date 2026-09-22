import { streamText } from "ai"
import { RULE_BY_ID, rewriteInstructions } from "@slop/rules"
import { spend, today } from "@/lib/server/budget"
import {
  hashedIp,
  json,
  preflight,
  readJson,
  withCors,
} from "@/lib/server/http"

const MAX_TEXT_CHARS = 4000
const MAX_BODY_CHARS = 20_000
const PER_IP_PER_DAY = 30
const DEFAULT_MODEL = "openai/gpt-4.1-mini"

export const OPTIONS = preflight

type RewriteRequest = { text: string; ruleIds: string[] }

function parseRequest(body: unknown): RewriteRequest | string {
  const { text, ruleIds } = (body ?? {}) as Record<string, unknown>
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > MAX_TEXT_CHARS
  ) {
    return `text must be 1-${MAX_TEXT_CHARS} characters`
  }
  const known = (id: unknown) => typeof id === "string" && id in RULE_BY_ID
  if (!Array.isArray(ruleIds) || !ruleIds.every(known)) {
    return "ruleIds must be rulebook ids"
  }
  return { text, ruleIds }
}

export async function POST(request: Request) {
  const parsed = parseRequest(await readJson(request, MAX_BODY_CHARS))
  if (typeof parsed === "string") return json({ error: parsed }, 400)

  const budget = {
    scope: "rewrite-ip",
    key: hashedIp(request.headers),
    period: today(),
    limit: PER_IP_PER_DAY,
  }
  if (!(await spend([budget], 1))) return json({ error: "over budget" }, 429)

  const result = streamText({
    model: process.env.REWRITE_MODEL ?? DEFAULT_MODEL,
    instructions: rewriteInstructions(parsed.ruleIds),
    prompt: parsed.text,
    onError: ({ error }) =>
      console.error("rewrite failed:", (error as Error)?.name),
  })
  return withCors(result.toTextStreamResponse())
}
