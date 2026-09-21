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
  arch: string
  sharperArch: string
  params: string
  trainN: string
  source: string | null
}

export type FigureId =
  "answers" | "extension" | "numbers" | "models" | "architecture"

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
    text: "I read a lot of text that a model wrote, and most days I only find out halfway through. It is the rhythm that gives it away. Three tidy points, a sentence that tells you what the next one will say, and a last line about the future. So I built Slop Meter, a small tool that notices the same things I do and says so in the margin.",
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

  { kind: "h", id: "built", text: "How it's built" },
  {
    kind: "p",
    text: `Standard never sees your words as words. A paragraph goes in and ${f.numbers} numbers come out. There is a score for each of the 36 rules a program can measure, the rate of 107 function words like the, of and which, and a few dozen counts: punctuation, how long the sentences run, whether you used a contraction. Measuring takes about a tenth of a millisecond.`,
  },
  {
    kind: "p",
    text: `Those numbers go into a network with three layers, ${f.arch}. That is ${f.params} weights, and I store them as 8-bit integers, which is how the whole thing fits in ${f.kb}. Rounding them moves no probability by more than 0.02. The network itself is one page of TypeScript, and a WGSL shader does the same sums on WebGPU.`,
  },
  { kind: "figure", figure: "architecture" },
  {
    kind: "p",
    text: `It learned from ${f.trainN} paragraphs, and a retrain takes a few minutes on my laptop. I fit five networks from different starting points and ship one: whichever catches the most text from current models while flagging no more than 1 person's paragraph in 1,000. A last step bends the raw outputs until a 90% really is right nine times in ten.`,
  },
  {
    kind: "p",
    text: `Sharper keeps all of that and widens the input by eight, to ${f.sharperArch}. It is three of those networks, not one. I train eight, keep the three that catch the most on text they never trained on, and average what they say. The eight extra numbers come from SmolLM2 reading the first 256 tokens: how likely it found each word, how open the choice was, where the word ranked, how much that varied. Two of them are the statistics from the Fast-DetectGPT and Binoculars papers. For every word the language model puts out 49,152 numbers, so a shader boils them down on the GPU and 16 bytes a word come back. Before I wrote that shader, Sharper held about 2 GB in a Safari tab. Now it holds under 600 MB.`,
  },

  { kind: "h", id: "rulebook", text: "The rulebook" },
  {
    kind: "p",
    text: `Every mark traces back to rules you can read. The [rulebook](/rules) has ${f.rules} of them, from stock vocabulary to the paragraph that ends by restating itself, and each comes with an example and the plain version. I use it as a style guide more often than as a detector. Most of the tells are habits of weak writing, and the models learned them from us.`,
  },

  { kind: "h", id: "try-it", text: "Try it" },
  {
    kind: "p",
    text: f.source
      ? `[Paste something](/) and watch the needle, or [add it to Chrome](/install). The code, the rulebook, the training scripts and the dated reports are [open source](${f.source}) under AGPL-3.0.`
      : "[Paste something](/) and watch the needle, or [add it to Chrome](/install). The code, the rulebook, the training scripts and the dated reports are open source under AGPL-3.0.",
  },
]

export const plain = (text: string) =>
  text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
