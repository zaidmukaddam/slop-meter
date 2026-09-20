import { generateText } from "ai"
import { readFileSync, writeFileSync } from "node:fs"

const unwrap = (s: string) => s.replace(/\s*\n\s*/g, " ").trim()
const walking = readFileSync(process.argv[2], "utf8").replace(/\r/g, "")
const start = walking.indexOf("I wish to speak a word for Nature")
const thoreau = walking
  .slice(start)
  .split(/\n\s*\n/)
  .slice(0, 3)
  .map(unwrap)
const fedHtml = readFileSync(process.argv[3], "utf8")
const fedBody = fedHtml.match(
  /<div class="col-xs-12 col-sm-8 col-md-8">([\s\S]*?)<\/div>/
)![1]
const fed = fedBody
  .split(/<\/p>/)
  .map((p) =>
    unwrap(
      p
        .replace(/<[^>]+>/g, "")
        .replace(/&#39;|&rsquo;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
    )
  )
  .filter((p) => p.split(" ").length > 30)
  .slice(0, 3)

const WIKI_REVISION = 996691925
const parsed = await (
  await fetch(
    `https://en.wikipedia.org/w/api.php?action=parse&oldid=${WIKI_REVISION}&prop=text&format=json&formatversion=2`,
    { headers: { "User-Agent": "slop-meter-examples/1.0" } }
  )
).json()
const wiki = [...parsed.parse.text.matchAll(/<p>([\s\S]*?)<\/p>/g)]
  .map((m: RegExpMatchArray) =>
    m[1]
      .replace(/<sup[\s\S]*?<\/sup>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#160;/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/\s+/g, " ")
      .trim()
  )
  .filter((p: string) => p.split(" ").length >= 25)

const today = new Date().toISOString().slice(0, 10)
const copyPrompt =
  "Write a product description for a stainless steel water bottle."
const replyPrompt =
  "Reply to a Reddit post from someone asking how to get better at cooking at home."
const essayPrompt =
  "Write a college application essay about a time you overcame a challenge."
const polishPrompt =
  "Improve the writing of this text. Keep the meaning and roughly the same length. Output only the revised text."
const CHEAP: [id: string, title: string, model: string, prompt: string][] = [
  [
    "machine-advice",
    "Model advice",
    "alibaba/qwen3.8-flash",
    "Someone on a forum asks how to prepare for a job interview. Write your answer.",
  ],
  [
    "machine-recipe",
    "Model blog post",
    "google/gemini-2.5-flash-lite",
    "Write a short blog post about the best way to cook rice.",
  ],
  [
    "machine-explainer",
    "Model explainer",
    "mistral/ministral-8b",
    "Explain why the sky is blue, for a general audience.",
  ],
]
const cheap = await Promise.all(
  CHEAP.map(async ([id, title, model, prompt]) => ({
    id,
    title,
    expect: "machine",
    source: `${model}, generated ${today}, prompt: "${prompt}"`,
    text: (await generateText({ model, prompt })).text.trim(),
  }))
)

const [copy, reply, essay, polished] = await Promise.all([
  generateText({ model: "openai/gpt-5.6-luna", prompt: copyPrompt }),
  generateText({ model: "openai/gpt-5.6-luna", prompt: replyPrompt }),
  generateText({ model: "deepseek/deepseek-v4.1-flash", prompt: essayPrompt }),
  generateText({
    model: "openai/gpt-5.6-luna",
    prompt: `${polishPrompt}\n\n${thoreau.slice(1).join("\n\n")}`,
  }),
])

const examples = [
  {
    id: "machine-copy",
    title: "Model product copy",
    expect: "machine",
    source: `openai/gpt-5.6-luna, generated ${today}, prompt: "${copyPrompt}"`,
    text: copy.text.trim(),
  },
  {
    id: "human-wiki",
    title: "Human encyclopedia",
    expect: "human",
    source: `"Ralph J. Erickstad", English Wikipedia, as of December 28, 2020 (revision ${WIKI_REVISION}). CC BY-SA 3.0.`,
    text: wiki.join("\n\n"),
  },
  ...cheap,
  {
    id: "machine-reply",
    title: "Model reply",
    expect: "machine",
    source: `openai/gpt-5.6-luna, generated ${today}, prompt: "${replyPrompt}"`,
    text: reply.text.trim(),
  },
  {
    id: "machine-essay",
    title: "Model essay",
    expect: "machine",
    source: `deepseek/deepseek-v4.1-flash, generated ${today}, prompt: "${essayPrompt}"`,
    text: essay.text.trim(),
  },
  {
    id: "human-essay",
    title: "Human essay",
    expect: "human",
    source:
      'Henry David Thoreau, "Walking" (1862). Public domain, Project Gutenberg #1022.',
    text: thoreau.join("\n\n"),
  },
  {
    id: "hybrid",
    title: "Hybrid",
    expect: "mixed",
    source: `Thoreau's paragraph 1 untouched, paragraphs 2 and 3 rewritten by openai/gpt-5.6-luna with the prompt "${polishPrompt}"`,
    text: [thoreau[0], polished.text.trim()].join("\n\n"),
  },
  {
    id: "press-release",
    title: "Corporate press release",
    expect: "human",
    source:
      "Federal Reserve press release, March 15, 2020 (public domain). Human, formal, the hard case.",
    text: fed.join("\n\n"),
  },
]
writeFileSync(
  new URL("examples.json", import.meta.url),
  JSON.stringify(examples, null, 2) + "\n"
)
console.log(
  examples.map((e) => `${e.id}: ${e.text.split(/\s+/).length} words`).join("\n")
)
