import { createHash } from "node:crypto"
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { generateText } from "ai"

const MODELS = [
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-5.6-luna",
  "google/gemini-3.1-flash-lite",
  "google/gemma-4-31b-it",
  "deepseek/deepseek-v4-flash",
  "meta/llama-4-scout",
  "mistral/mistral-small",
  "alibaba/qwen3.5-flash",
]
const HOLDOUT = new Set([
  "anthropic/claude-sonnet-5",
  "google/gemini-3-flash",
  "moonshotai/kimi-k2.5",
  "mistral/mistral-small",
])
const GENRE_BY_DOMAIN: Record<string, string> = {
  reddit: "a Reddit post",
  reviews: "a Yelp review",
  wiki: "an encyclopedia article section",
  news: "a news article",
  abstracts: "a scientific paper abstract",
  books: "a passage from a novel",
}
const SOCIAL_GENRES = ["a blog post", "a LinkedIn post", "a newsletter intro"]
const SOCIAL_GENRE_SHARE = 0.15
const LENGTH_HINTS = [
  "",
  "",
  "Around 150 words.",
  "Keep it under 200 words.",
  "Use markdown formatting if it helps.",
]
const TEMPERATURES = [0.2, 0.7, 1.0]
const CONCURRENCY = 24
const ANTI_TELL =
  'Make it read like a real person wrote it: no em dashes, no words like "delve" or "tapestry", ' +
  "no lists of three, use contractions and plain words, vary sentence length, include a specific detail or two. " +
  "Output only the text, and don't mention these instructions."
const POLISH =
  "Improve the writing of this text. Keep the meaning and roughly the same length. Output only the revised text."

type Mode = "plain" | "antitell" | "polish"
type Seed = { domain: string; group: string; topic: string; human: string }
type Job = {
  key: string
  seed: Seed
  mode: Mode
  model: string
  prompt: string
}

const OUT = new URL("data/gen.jsonl", import.meta.url)
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]
const sha1 = (text: string) => createHash("sha1").update(text).digest()

function modeFor(hash: number): Mode {
  const slot = hash % 10
  if (slot < 5) return "plain"
  if (slot < 7) return "antitell"
  return "polish"
}

function webPrompt(seed: Seed, extra: string): string {
  return (
    `Write one paragraph of the web page ${seed.topic}, in the voice of whoever runs the page, for its readers. ` +
    `Don't describe the page, mention its address, or copy its opening. Output only the paragraph. ${extra}`
  )
}

function promptFor(mode: Mode, seed: Seed): string {
  const genre = GENRE_BY_DOMAIN[seed.domain]
  switch (mode) {
    case "plain": {
      if (seed.domain === "web") return webPrompt(seed, pick(LENGTH_HINTS))
      const social = Math.random() < SOCIAL_GENRE_SHARE
      const kind = social ? pick(SOCIAL_GENRES) : genre
      return `Write ${kind} about: ${seed.topic}. ${pick(LENGTH_HINTS)}`
    }
    case "antitell":
      if (seed.domain === "web") return webPrompt(seed, ANTI_TELL)
      return `Write ${genre} about: ${seed.topic}. ${ANTI_TELL}`
    case "polish":
      return `${POLISH}\n\n${seed.human}`
  }
}

function readJsonl<T>(url: URL): T[] {
  if (!existsSync(url)) return []
  const lines = readFileSync(url, "utf8").split("\n").filter(Boolean)
  return lines.map((line) => JSON.parse(line))
}

function plannedJobs(count: number, offset: number, only?: Mode): Job[] {
  const seeds = readJsonl<Seed>(new URL("data/seeds.jsonl", import.meta.url))
  const done = new Set(readJsonl<{ key: string }>(OUT).map((row) => row.key))
  return seeds
    .map((seed) => ({ seed, hash: sha1(seed.group) }))
    .sort((a, b) => Buffer.compare(a.hash, b.hash))
    .slice(offset, offset + count)
    .map(({ seed, hash }) => {
      const mode = only ?? modeFor(hash.readUInt32BE(0))
      const model = MODELS[hash.readUInt32BE(4) % MODELS.length]
      const key = `${seed.group}:${mode}:${model}`
      return { key, seed, mode, model, prompt: promptFor(mode, seed) }
    })
    .filter((job) => !done.has(job.key))
}

async function run(job: Job) {
  const { text, usage } = await generateText({
    model: job.model,
    prompt: job.prompt,
    temperature: pick(TEMPERATURES),
    maxOutputTokens: 700,
    maxRetries: 1,
  })
  const heldOut = job.mode === "antitell" && HOLDOUT.has(job.model)
  const row = {
    key: job.key,
    text,
    label: job.mode === "polish" ? "mixed" : "machine",
    source: `gateway-${job.mode}`,
    domain: job.seed.domain,
    model: job.model,
    group: job.seed.group,
    split: heldOut ? "adv" : undefined,
  }
  appendFileSync(OUT, JSON.stringify(row) + "\n")
  return usage.outputTokens ?? 0
}

async function main() {
  ;(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false
  const count = Number(process.argv[2] ?? 2600)
  const offset = Number(process.argv[3] ?? 0)
  const only = process.argv[4] as Mode | undefined
  if (only && !["plain", "antitell", "polish"].includes(only)) {
    throw new Error(`mode must be plain, antitell or polish, not ${only}`)
  }
  const queue = plannedJobs(count, offset, only)
  let ok = 0
  let failed = 0
  let tokens = 0

  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        tokens += await run(job)
        ok++
      } catch (error) {
        failed++
        console.error(job.model, String(error).slice(0, 160))
      }
      if ((ok + failed) % 100 === 0) {
        console.log(`${ok} ok, ${failed} failed, ${tokens} output tokens`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`done: ${ok} ok, ${failed} failed, ${tokens} output tokens`)
}

await main()
