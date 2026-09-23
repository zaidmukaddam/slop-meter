import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 2_000_000
const MAX_CSS_BYTES = 1_000_000
const MAX_STYLESHEETS = 6
const MAX_REDIRECTS = 3
const AGENT = "SlopMeterAudit/1.0 (+https://slop-meter.com/audit)"

export class AuditError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7))
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb")
  )
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim()
  let url: URL
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    )
  } catch {
    throw new AuditError("That doesn't look like a web address.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuditError("Only http and https addresses can be audited.")
  }
  if (url.username || url.password) {
    throw new AuditError(
      "Addresses with a username or password can't be audited."
    )
  }
  if (!url.hostname.includes(".") && isIP(url.hostname) === 0) {
    throw new AuditError("That doesn't look like a public web address.")
  }
  return url
}

async function assertPublic(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address)
  if (!addresses.length) throw new AuditError(`Couldn't find ${url.hostname}.`)
  if (addresses.some(isPrivateAddress)) {
    throw new AuditError("That address points at a private network.")
  }
}

async function readCapped(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      break
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

async function get(start: URL, accept: string, max: number) {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url)
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": AGENT, accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((error: Error) => {
      throw new AuditError(
        error.name === "TimeoutError"
          ? `${url.hostname} took too long to answer.`
          : `Couldn't reach ${url.hostname}.`,
        502
      )
    })
    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location) {
      url = normalizeUrl(new URL(location, url).href)
      continue
    }
    return { url, response, body: await readCapped(response, max) }
  }
  throw new AuditError("That page redirects too many times.", 502)
}

export async function fetchPage(input: string) {
  const {
    url,
    response,
    body: html,
  } = await get(
    normalizeUrl(input),
    "text/html,application/xhtml+xml",
    MAX_HTML_BYTES
  )
  if (!response.ok) {
    throw new AuditError(
      `${url.hostname} answered with ${response.status}.`,
      502
    )
  }
  if (!/html/i.test(response.headers.get("content-type") ?? "")) {
    throw new AuditError("That address isn't a web page.", 422)
  }
  const hrefs = [
    ...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi),
  ]
    .map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1])
    .filter((href): href is string => Boolean(href))
    .slice(0, MAX_STYLESHEETS)
  const sheets = await Promise.all(
    hrefs.map((href) =>
      get(new URL(href, url), "text/css", MAX_CSS_BYTES)
        .then(({ response, body }) => (response.ok ? body : ""))
        .catch(() => "")
    )
  )
  return { url: url.href, html, css: sheets.join("\n") }
}
