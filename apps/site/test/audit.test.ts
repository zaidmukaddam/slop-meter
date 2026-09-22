import assert from "node:assert/strict"
import { test } from "node:test"
import { audit } from "../lib/audit/checks.ts"
import {
  AuditError,
  isPrivateAddress,
  normalizeUrl,
} from "../lib/server/fetch-page.ts"

const SLOP = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700" rel="stylesheet">
<style>body { background: #ffffff } .glow { text-shadow: 0 0 12px #0ff }</style>
</head><body class="bg-black">
<h1>Ship faster ✨ with AI</h1>
<div class="absolute rounded-full blur-3xl bg-purple-500"></div>
<div class="grid md:grid-cols-3 gap-6">
  <div class="rounded-2xl shadow-xl backdrop-blur-md bg-violet-500/10"><svg class="lucide lucide-zap"></svg></div>
  <div class="rounded-2xl shadow-xl md:col-span-2 bg-indigo-600"><svg class="lucide lucide-shield"></svg></div>
  <div class="rounded-2xl shadow-xl md:row-span-2 bg-purple-600"><svg class="lucide lucide-sparkles"></svg></div>
</div>
<div class="rounded-2xl shadow-xl"></div><div class="rounded-2xl shadow-xl"></div>
<p>It's not just a tool, it's a movement — a whole new way to work — and your team will love it.</p>
<ul><li>✓ Fast</li><li>✓ Secure</li><li>✓ Scalable</li></ul>
<p>$9/mo</p><p>$29/mo</p><p>$99/mo</p>
<a class="group" href="/start">Start <span class="group-hover:translate-x-1">→</span></a>
<div class="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text"></div>
<div class="bg-gradient-to-br from-green-400 to-yellow-400"></div>
</body></html>`

const PLAIN = `<!doctype html><html><head><style>body { background: #f4f1ea; font-family: "Tiempos", serif }</style></head>
<body><h1>Notes from the workshop</h1>
<p>I rebuilt the bench vise last week. It took two evenings and a lot of swearing at a seized bolt.</p>
<footer><a href="/privacy">Privacy</a> <a href="/terms">Terms</a></footer>
</body></html>`

const hits = (html: string, css = "") =>
  new Set(
    audit({ html, css })
      .filter((f) => f.hit)
      .map((f) => f.id)
  )

test("a templated landing page trips the tells it has", () => {
  const found = hits(SLOP)
  for (const id of [
    "em-dash",
    "not-x-its-y",
    "checkmarks",
    "emojis",
    "fonts",
    "lucide",
    "sparkles",
    "gradients",
    "orbs",
    "shadows",
    "glass",
    "radius",
    "purple-black",
    "rainbow",
    "pure-white",
    "three-cards",
    "bento",
    "pricing",
    "arrows",
    "no-terms",
    "no-privacy",
  ]) {
    assert.ok(found.has(id), `expected ${id}`)
  }
})

test("a plain hand-made page trips none of them", () => {
  assert.deepEqual([...hits(PLAIN)], [])
})

test("fonts are read from linked stylesheets too", () => {
  const found = hits(PLAIN, "body { font-family: Geist, sans-serif }")
  assert.ok(found.has("fonts"))
})

test("private and internal addresses are refused", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.8",
    "172.20.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.ok(isPrivateAddress(ip), `${ip} should be private`)
  }
  for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.ok(!isPrivateAddress(ip), `${ip} should be public`)
  }
})

test("addresses are normalized and odd ones rejected", () => {
  assert.equal(normalizeUrl("example.com").href, "https://example.com/")
  assert.equal(
    normalizeUrl(" http://example.com/a ").href,
    "http://example.com/a"
  )
  for (const bad of [
    "ftp://example.com",
    "localhost",
    "https://user:pw@example.com",
    "not a url",
  ]) {
    assert.throws(() => normalizeUrl(bad), AuditError, bad)
  }
})
