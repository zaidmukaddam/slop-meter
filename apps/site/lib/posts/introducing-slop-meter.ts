/**
 * The launch post, as data. It lives apart from the page for one reason: a test reads
 * every paragraph here through the shipped model, and a post about machine-sounding
 * prose has no business sounding like a machine wrote it.
 *
 * Numbers are never typed into the prose. They arrive as facts from the dated reports,
 * so the post cannot disagree with the models page. Links are written [text](/href).
 */

export type PostFacts = {
  kb: string
  numbers: string
  rules: string
  heldOut: string
  answers: string
  right: string
  humanCalledMachine: string
  webN: string
  webMachine: string
  sharperAnswers: string
  download: string
  source: string | null
}

export type FigureId = "answers" | "extension" | "numbers" | "models"

export type PostBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; id: string; text: string }
  | { kind: "figure"; figure: FigureId }

export const meta = {
  slug: "introducing-slop-meter",
  title: "Introducing Slop Meter",
  dek: "A Chrome extension and a site that mark writing paragraph by paragraph: human-ish, machine-ish, mixed, or can't tell. It runs on your device, and it would rather say nothing than accuse a person.",
  date: "2026-09-20",
  author: "Zaid Mukaddam",
}

export const body = (f: PostFacts): PostBlock[] => [
  {
    kind: "p",
    text: "I read a lot of text that a model wrote, and I usually find out halfway through. The rhythm gives it away first. Three tidy points, a sentence announcing what the next sentence will say, a closing line about the future. Slop Meter is a small tool that notices the same things and says so in the margin.",
  },
  {
    kind: "p",
    text: "It is a Chrome extension and a site. The extension puts a dot beside each paragraph on the pages you read. The site does the same for anything you paste, or any document you drop on it. Both do the scoring on your device, and neither one sends your text anywhere.",
  },

  { kind: "h", id: "answers", text: "Four answers" },
  {
    kind: "p",
    text: "Every paragraph gets one of four answers: human-ish, machine-ish, mixed, or can't tell. Mixed means a person and a model both had a hand in it, which is how a draft looks after someone asks a chatbot to tidy it up. The answers end in -ish because this is a judgement about style. It can't tell you who wrote something, and it doesn't pretend to.",
  },
  { kind: "figure", figure: "answers" },
  {
    kind: "p",
    text: "Behind each answer are odds, and I've tried to keep them honest. When the meter reports 90%, it is right about nine times in ten on text it has never seen. Hover a dot and a card opens with those odds and the three rules that pushed hardest. The words that set each rule off are marked in the paragraph, so you can argue with it.",
  },
  { kind: "figure", figure: "extension" },

  { kind: "h", id: "cant-tell", text: "Why it mostly says can't tell" },
  {
    kind: "p",
    text: `On ${f.heldOut} paragraphs kept out of training, it gives an answer on ${f.answers} of them. On the rest it says can't tell. That is on purpose.`,
  },
  {
    kind: "p",
    text: "A detector can be wrong in two directions, and they don't cost the same. Missing a machine paragraph takes nothing from you. Calling a person's writing machine-made is an accusation, and an accusation from a tool tends to stick. So the meter speaks only when its top guess clears a bar, and two rules set the bars. Its calls have to be right at least 96 times in 100. And it may call at most 1 human paragraph in 1,000 machine-ish. A model that can't hold both rules doesn't ship.",
  },
  {
    kind: "p",
    text: `When it does speak, it is right ${f.right} of the time, and it calls ${f.humanCalledMachine} of human paragraphs machine-ish. The harder check is the open web: ${f.webN} paragraphs from pages published in 2019, before chatbots, on sites the model never trained on. People wrote every one of them, so any machine-ish call there is a mistake. It makes that mistake on ${f.webMachine} of them.`,
  },
  { kind: "figure", figure: "numbers" },

  { kind: "h", id: "on-device", text: "It runs on your device" },
  {
    kind: "p",
    text: `The model is ${f.kb}. It reads ${f.numbers} numbers from each paragraph: one for each rule it can measure, and the rest plain statistics such as sentence length and how often words repeat. It runs on WebGPU where the browser has it and on the CPU where it doesn't, in well under a millisecond a paragraph. There is no server in the loop because a server would have nothing to do.`,
  },
  {
    kind: "p",
    text: `Two features do leave your device, and both stay off until you turn them on. Rewrite sends one paragraph to a server, which asks a model to redo it without the tells. The You're wrong button sends the ${f.numbers} numbers and your answer. It never sends the text.`,
  },

  { kind: "h", id: "models", text: "Two models" },
  {
    kind: "p",
    text: `Standard is the model described so far. Sharper reading adds a small language model, SmolLM2 at 135 million parameters, which reads the same paragraph on your machine and reports how surprising it found each word. Machine text is text a language model finds unsurprising. Eight extra numbers from that reading let the meter answer on ${f.sharperAnswers} of paragraphs instead of ${f.answers}, and it is right about as often. The price is a ${f.download} download, once. The [models page](/models) sets the two side by side.`,
  },
  { kind: "figure", figure: "models" },

  { kind: "h", id: "rulebook", text: "The rulebook" },
  {
    kind: "p",
    text: `Every mark traces back to rules you can read. The [rulebook](/rules) has ${f.rules} of them, from stock vocabulary to the paragraph that ends by restating itself, and each comes with an example and the plain version. I use it as a style guide more often than as a detector. Most of the tells are habits of weak writing, and the models learned them from us.`,
  },

  { kind: "h", id: "limits", text: "What it can't do" },
  {
    kind: "p",
    text: "Paraphrasing beats it. Run machine text through a paraphraser and the meter catches fewer than 1 paragraph in 10. Training it on paraphrased text fixes that, and also triples the false accusations on human web pages. I left it broken in the safe direction.",
  },
  {
    kind: "p",
    text: "It is weakest on human writing that a model has polished. It reads English only, and leaves anything else unmarked. Its picture of how people write on the web comes from a single crawl in 2019. Text from the newest models mostly gets can't tell. The [models page](/models) has every number, the bad ones included.",
  },

  { kind: "h", id: "try-it", text: "Try it" },
  {
    kind: "p",
    text: f.source
      ? `[Paste something](/) and watch the needle, or [add it to Chrome](/install). The code, the rulebook, the training scripts and the dated reports are [open source](${f.source}) under AGPL-3.0.`
      : "[Paste something](/) and watch the needle, or [add it to Chrome](/install). The code, the rulebook, the training scripts and the dated reports are open source under AGPL-3.0.",
  },
]

/** A paragraph as a reader sees it, without the link syntax. */
export const plain = (text: string) =>
  text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
