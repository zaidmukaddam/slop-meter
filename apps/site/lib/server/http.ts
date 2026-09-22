import { createHash } from "node:crypto"

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

export function withCors(response: Response): Response {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(name, value)
  }
  return response
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

export function hashedIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  const ip =
    forwarded?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown"
  return createHash("sha256")
    .update(`slop-meter:${ip}`)
    .digest("hex")
    .slice(0, 32)
}

export async function readJson(
  request: Request,
  maxChars: number
): Promise<unknown> {
  const text = await request.text()
  if (text.length > maxChars) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
