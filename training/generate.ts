import { createHash } from "node:crypto"
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { generateText } from "ai"

const MODELS = [
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-5.6-luna",
  "openai/gpt-5-mini",
  "openai/gpt-oss-120b",
  "google/gemini-3.1-flash-lite",
  "google/gemini-3.8-flash",
  "google/gemma-4-31b-it",
  "anthropic/claude-haiku-4.5",
  "deepseek/deepseek-v4-flash",
  "meta/llama-4-scout",
  "meta/llama-4-maverick",
  "mistral/mistral-small",
  "mistral/mistral-large-3",
  "alibaba/qwen3.5-flash",
  "alibaba/qwen3.8-flash",
  "spacexai/grok-4.1-fast-non-reasoning",
  "zai/glm-5.3-flash",
  "minimax/minimax-m3",
  "amazon/nova-2-lite",
  "nvidia/nemotron-3-super-120b-a12b",
  "xiaomi/mimo-v2.5",
]
type Via = "gateway" | "openai" | "cloudflare" | "bedrock"
type Route = { model: string; via: Via; name: string }
const ROUND_TWO: Route[] = [
  { model: "openai/gpt-5.6-terra", via: "openai", name: "gpt-5.6-terra" },
  { model: "openai/gpt-5.4", via: "openai", name: "gpt-5.4" },
  { model: "openai/gpt-5.4-mini", via: "openai", name: "gpt-5.4-mini" },
  {
    model: "anthropic/claude-sonnet-5",
    via: "bedrock",
    name: "global.anthropic.claude-sonnet-5",
  },
  { model: "spacexai/grok-4.7", via: "gateway", name: "spacexai/grok-4.7" },
  {
    model: "moonshotai/kimi-k2.6",
    via: "cloudflare",
    name: "@cf/moonshotai/kimi-k2.6",
  },
  {
    model: "deepseek/deepseek-v4-pro",
    via: "cloudflare",
    name: "@cf/deepseek-ai/deepseek-v4-pro-0813",
  },
  {
    model: "alibaba/qwen3.8-27b",
    via: "cloudflare",
    name: "@cf/qwen/qwen3.8-27b",
  },
  {
    model: "google/gemma-4-26b-a4b-it",
    via: "cloudflare",
    name: "@cf/google/gemma-4-26b-a4b-it",
  },
]
const ROUNDS: Route[][] = [
  MODELS.map((model) => ({ model, via: "gateway", name: model })),
  ROUND_TWO,
]
const THINKING_ALOUD =
  /^(<think|the user (wants|is asking|asked)|let me think)/i
const MAX_OUTPUT_TOKENS = 3000
const MIN_WORDS = 25
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
const SOCIAL_GENRES = [
  "a blog post",
  "a LinkedIn post",
  "a newsletter intro",
  "a product description",
  "a forum answer",
  "an email to a colleague",
  "a short essay",
  "a how-to guide",
  "a cover letter paragraph",
]
const SOCIAL_GENRE_SHARE = 0.3
const FRAMES: ((kind: string, topic: string) => string)[] = [
  (kind, topic) => `Write ${kind} about: ${topic}.`,
  (kind, topic) => `Write ${kind} about: ${topic}.`,
  (kind, topic) => `I need ${kind} about: ${topic}. Can you draft it?`,
  (kind, topic) => `Draft ${kind}. The subject: ${topic}.`,
  (kind, topic) => `${topic}\n\nTurn the above into ${kind}.`,
  (kind, topic) => `Write ${kind} about: ${topic}. Use the first person.`,
  (kind, topic) => `Write ${kind} about: ${topic}. Keep it casual.`,
  (kind, topic) =>
    `Write ${kind} about: ${topic}. Keep the tone formal and neutral.`,
]
const SYSTEMS = [
  undefined,
  undefined,
  undefined,
  "You are a helpful assistant.",
  "You are a professional copywriter.",
  "You are a friendly expert who explains things clearly.",
]
const LENGTH_HINTS = [
  "",
  "",
  "Around 150 words.",
  "Keep it under 200 words.",
  "Use markdown formatting if it helps.",
]
const TEMPERATURES = [0.2, 0.7, 1.0]
const CONCURRENCY = 72
const ANTI_TELL =
  'Make it read like a real person wrote it: no em dashes, no words like "delve" or "tapestry", ' +
  "no lists of three, use contractions and plain words, vary sentence length, include a specific detail or two. " +
  "Output only the text, and don't mention these instructions."
const POLISH =
  "Improve the writing of this text. Keep the meaning and roughly the same length. Output only the revised text."
const HUMANIZE = [
  "Write it so nobody would take it for AI writing. Leave out puffed-up significance (pivotal, testament, landscape, underscores), " +
    "promotional adjectives, -ing clauses tacked onto the end of a sentence, vague sources like 'experts say', 'not just X but Y', " +
    "lists of three, a new synonym each time you mention the same thing, 'from X to Y' ranges, em dashes, colons used as connectors, " +
    "bold labels, title-case headings, emoji, stacked hedges and a tidy upbeat ending. Use plain words and active verbs. " +
    "Output only the text, and don't mention these instructions.",
  "Write it the way one particular person would. Have an opinion and say it. Mix short sentences with long ones. Use 'I' where it fits. " +
    "Admit what you aren't sure about. Be specific: a real number, a name, one concrete detail. Let a tangent or a half-finished thought stay in. " +
    "Don't sum up at the end. Output only the text, and don't mention these instructions.",
  "Say what happened, not how it feels. One idea per sentence. Active voice, and name who did it. Cut the adverbs. " +
    "Prefer the plain word: use, help, many, if, because. No warm-up opener and no recap at the end. " +
    "Output only the text, and don't mention these instructions.",
  ANTI_TELL,
]
const REWRITE_LEAD =
  "Below is a draft. Rewrite it so it reads like a person wrote it. Keep the facts and roughly the same length."
const HARD_MODES = new Set(["antitell", "humanize", "rewrite"])

type Mode = "plain" | "antitell" | "humanize" | "rewrite" | "polish"
const MODES: Mode[] = ["plain", "antitell", "humanize", "rewrite", "polish"]
type Seed = { domain: string; group: string; topic: string; human: string }
type Job = {
  key: string
  seed: Seed
  mode: Mode
  route: Route
  prompt: string
}

const OUT = new URL("data/gen.jsonl", import.meta.url)
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]
const sha1 = (text: string) => createHash("sha1").update(text).digest()

function modeFor(hash: number): Mode {
  const slot = hash % 20
  if (slot < 9) return "plain"
  if (slot < 11) return "antitell"
  if (slot < 14) return "humanize"
  if (slot < 16) return "rewrite"
  return "polish"
}

function webPrompt(seed: Seed, extra: string): string {
  return (
    `Write one paragraph of the web page ${seed.topic}, in the voice of whoever runs the page, for its readers. ` +
    `Don't describe the page, mention its address, or copy its opening. Output only the paragraph. ${extra}`
  )
}

function plainPrompt(seed: Seed): string {
  if (seed.domain === "web") return webPrompt(seed, pick(LENGTH_HINTS))
  const social = Math.random() < SOCIAL_GENRE_SHARE
  const kind = social ? pick(SOCIAL_GENRES) : GENRE_BY_DOMAIN[seed.domain]
  return `${pick(FRAMES)(kind, seed.topic)} ${pick(LENGTH_HINTS)}`.trim()
}

function promptFor(mode: Mode, seed: Seed): string {
  const genre = GENRE_BY_DOMAIN[seed.domain]
  switch (mode) {
    case "plain":
    case "rewrite":
      return plainPrompt(seed)
    case "antitell":
      if (seed.domain === "web") return webPrompt(seed, ANTI_TELL)
      return `Write ${genre} about: ${seed.topic}. ${ANTI_TELL}`
    case "humanize": {
      const how = pick(HUMANIZE)
      if (seed.domain === "web") return webPrompt(seed, how)
      return `${pick(FRAMES)(genre, seed.topic)} ${how}`
    }
    case "polish":
      return `${POLISH}\n\n${seed.human}`
  }
}

function readJsonl<T>(url: URL): T[] {
  if (!existsSync(url)) return []
  const lines = readFileSync(url, "utf8").split("\n").filter(Boolean)
  return lines.map((line) => JSON.parse(line))
}

function plannedJobs(
  count: number,
  offset: number,
  round: number,
  only?: Mode
): Job[] {
  const routes = ROUNDS[round]
  const seeds = readJsonl<Seed>(new URL("data/seeds.jsonl", import.meta.url))
  const done = new Set(readJsonl<{ key: string }>(OUT).map((row) => row.key))
  return seeds
    .map((seed) => ({ seed, hash: sha1(seed.group) }))
    .sort((a, b) => Buffer.compare(a.hash, b.hash))
    .slice(offset, offset + count)
    .map(({ seed, hash }) => {
      const mode = only ?? modeFor(hash.readUInt32BE(8 * round))
      const route = routes[hash.readUInt32BE(8 * round + 4) % routes.length]
      const key = `${seed.group}:${mode}:${route.model}`
      return { key, seed, mode, route, prompt: promptFor(mode, seed) }
    })
    .filter((job) => !done.has(job.key))
}

const env = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

async function post(url: string, key: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(
      `${response.status} ${(await response.text()).slice(0, 120)}`
    )
  }
  return response.json()
}

async function complete(
  route: Route,
  prompt: string,
  system: string | undefined,
  temperature: number
): Promise<{ text: string; tokens: number }> {
  if (route.via === "gateway") {
    const { text, usage } = await generateText({
      model: route.name,
      system,
      prompt,
      temperature,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 1,
    })
    return { text, tokens: usage.outputTokens ?? 0 }
  }
  if (route.via === "bedrock") {
    const region = process.env.AWS_REGION ?? "us-east-1"
    const reply = await post(
      `https://bedrock-runtime.${region}.amazonaws.com/model/${route.name}/converse`,
      env("AMAZON_BEDROCK_API_KEY"),
      {
        messages: [{ role: "user", content: [{ text: prompt }] }],
        ...(system && { system: [{ text: system }] }),
        inferenceConfig: { maxTokens: MAX_OUTPUT_TOKENS },
      }
    )
    const parts: { text?: string }[] = reply.output?.message?.content ?? []
    return {
      text: parts.map((part) => part.text ?? "").join(""),
      tokens: reply.usage?.outputTokens ?? 0,
    }
  }
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: prompt },
  ]
  const reply =
    route.via === "openai"
      ? await post(
          "https://api.openai.com/v1/chat/completions",
          env("OPENAI_API_KEY"),
          {
            model: route.name,
            messages,
            max_completion_tokens: MAX_OUTPUT_TOKENS,
            reasoning_effort: "low",
          }
        )
      : await post(
          `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/ai/v1/chat/completions`,
          env("CLOUDFLARE_API_TOKEN"),
          {
            model: route.name,
            messages,
            temperature,
            max_tokens: MAX_OUTPUT_TOKENS,
            chat_template_kwargs: { thinking: false, enable_thinking: false },
          }
        )
  return {
    text: reply.choices?.[0]?.message?.content ?? "",
    tokens: reply.usage?.completion_tokens ?? 0,
  }
}

async function write(route: Route, prompt: string, system?: string) {
  const { text, tokens } = await complete(
    route,
    prompt,
    system,
    pick(TEMPERATURES)
  )
  if (text.trim().split(/\s+/).length < MIN_WORDS) {
    throw new Error(`only ${text.trim().length} characters came back`)
  }
  if (THINKING_ALOUD.test(text.trim())) {
    throw new Error("the model's reasoning came back in place of the text")
  }
  return { text, tokens }
}

async function run(job: Job) {
  const system = job.mode === "polish" ? undefined : pick(SYSTEMS)
  const first = await write(job.route, job.prompt, system)
  const second =
    job.mode === "rewrite"
      ? await write(
          job.route,
          `${REWRITE_LEAD} ${pick(HUMANIZE)}\n\n${first.text}`
        )
      : null
  const text = second?.text ?? first.text
  const heldOut = HARD_MODES.has(job.mode) && HOLDOUT.has(job.route.model)
  const row = {
    key: job.key,
    text,
    label: job.mode === "polish" ? "mixed" : "machine",
    source: `gateway-${job.mode}`,
    domain: job.seed.domain,
    model: job.route.model,
    group: job.seed.group,
    split: heldOut ? "adv" : undefined,
  }
  appendFileSync(OUT, JSON.stringify(row) + "\n")
  return first.tokens + (second?.tokens ?? 0)
}

async function main() {
  ;(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false
  const count = Number(process.argv[2] ?? 2600)
  const offset = Number(process.argv[3] ?? 0)
  const round = Number(process.argv[4] ?? 0)
  const only = process.argv[5] as Mode | undefined
  if (!ROUNDS[round]) throw new Error(`round must be below ${ROUNDS.length}`)
  if (only && !MODES.includes(only)) {
    throw new Error(`mode must be one of ${MODES.join(", ")}, not ${only}`)
  }
  const queue = plannedJobs(count, offset, round, only)
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
        console.error(job.route.model, String(error).slice(0, 160))
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
