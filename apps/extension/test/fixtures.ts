export const MACHINE = [
  "In today's fast-paced digital landscape, it's important to note that artificial intelligence plays a pivotal role in shaping the future of work. Moreover, this transformative technology fosters innovation, streamlines workflows, and empowers teams to unlock their full potential. Ultimately, the future looks bright.",
  "Nestled in the heart of the region, the city stands as a testament to its rich cultural heritage. Its vibrant markets, breathtaking architecture, and renowned cuisine showcase a tapestry of traditions that continue to captivate visitors from around the world. Despite its challenges, the city continues to thrive.",
  "Certainly! Here's a comprehensive overview of the topic. Additionally, it is worth noting that robust strategies can seamlessly enhance collaboration and foster a holistic approach. I hope this helps, and feel free to let me know if you have any other questions!",
]

export const HUMAN = [
  "I tried the new bakery on Elm yesterday and honestly the croissants were kind of a letdown, flaky enough but way too sweet. My sister liked them though. We'll probably go back for the sourdough, which the guy at the counter swore by, and it's cheap.",
  "Dad's truck died again on the way to Duluth, so we sat at a Kwik Trip for three hours eating gas station pizza while he argued with the tow guy on the phone. Not the worst Saturday. I finished my book and the kids made friends with a dog named Pickle.",
  "Look, I've run this league for eleven years and nobody has ever complained about the Tuesday slot until now. If you can't make it, trade with Marco's team. I'm not rebuilding the whole schedule because two people double-booked themselves. Sorry, but no.",
]

const LIST_ITEMS = [
  [
    "Scalability:",
    "The platform seamlessly scales to meet the evolving needs of modern businesses.",
  ],
  [
    "Security:",
    "Robust, state-of-the-art encryption ensures that your data remains protected at all times.",
  ],
  [
    "Collaboration:",
    "Intuitive tools foster seamless teamwork and empower teams to achieve more.",
  ],
]

export const LIST_TEXT = LIST_ITEMS.map(
  ([label, rest]) => `- **${label}** ${rest}`
).join("\n")

export const SCORED_BLOCKS: Record<string, string> = {
  m0: MACHINE[0],
  m1: MACHINE[1],
  m2: MACHINE[2],
  h0: HUMAN[0],
  h1: HUMAN[1],
  h2: HUMAN[2],
  list: LIST_TEXT,
}

export const NEVER_MARKED = ["nav", "foot", "short", "hidden", "pre", "edit"]

const CHROME_TEXT =
  "This sentence is long enough to count as real navigation text but it lives inside a nav element and must never be scored or marked by the extension at all."

export const TEST_PAGE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Slop test</title>
    <meta name="author" content="Test" />
    <style>
      body { margin: 0; font: 16px/1.6 Georgia, serif; }
      main { max-width: 640px; margin: 0 auto; padding: 24px; }
      p, ul { margin: 0 0 16px; }
    </style>
  </head>
  <body>
    <nav><p id="nav">${CHROME_TEXT}</p></nav>
    <main>
      <h1>Test article</h1>
      ${MACHINE.map((text, i) => `<p id="m${i}">${text}</p>`).join("\n")}
      ${HUMAN.map((text, i) => `<p id="h${i}">${text}</p>`).join("\n")}
      <ul id="list">
        ${LIST_ITEMS.map(([label, rest]) => `<li><strong>${label}</strong> ${rest}</li>`).join("\n")}
      </ul>
      <p id="short">Too short to score.</p>
      <p id="hidden" style="display: none">${MACHINE[0]} Hidden copy.</p>
      <pre id="pre">${MACHINE[1]}</pre>
      <div id="edit" contenteditable>${MACHINE[2]} Editable copy.</div>
    </main>
    <footer><p id="foot">${CHROME_TEXT} Footer copy.</p></footer>
  </body>
</html>`

export const THREAD_COMMENTS = [
  MACHINE,
  [HUMAN[0]],
  [HUMAN[1]],
  [HUMAN[2]],
  [MACHINE[1]],
]

export const THREAD_PAGE = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Thread</title></head>
  <body>
    <table>
      ${THREAD_COMMENTS.map(
        (paragraphs, i) =>
          `<tr><td><div class="comment" id="c${i}">${paragraphs.map((p) => `<p>${p}</p>`).join("")}</div></td></tr>`
      ).join("\n")}
    </table>
  </body>
</html>`

export const LONG_PAGE_PARAGRAPHS = 200
const SAMPLES = [...MACHINE, ...HUMAN]
const NOTE_MULTIPLIER = 7919
const NOTE_MODULUS = 1000

export const LONG_PAGE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Long</title>
    <style>
      body { font: 16px/1.6 Georgia, serif; }
      article { max-width: 640px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <article>
      ${Array.from({ length: LONG_PAGE_PARAGRAPHS }, (_, i) => {
        const note = (i * NOTE_MULTIPLIER) % NOTE_MODULUS
        const text = SAMPLES[i % SAMPLES.length]
        return `<p id="p${i}">${text} Paragraph ${i} adds note ${note}.</p>`
      }).join("\n")}
    </article>
  </body>
</html>`
