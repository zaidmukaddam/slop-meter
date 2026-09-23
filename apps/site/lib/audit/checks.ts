export type Page = { html: string; css: string }

export type Group =
  "Copy" | "Type and icons" | "Surfaces" | "Colour" | "Layout" | "Trust"

export type Finding = {
  id: string
  group: Group
  title: string
  hit: boolean
  evidence: string
}

type Check = {
  id: string
  group: Group
  title: string
  test: (page: Parsed) => string | null
}

type Parsed = Page & {
  text: string
  classes: string
  headings: string[]
  links: string[]
}

const count = (re: RegExp, s: string) => s.match(re)?.length ?? 0
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&#8212;/g, "—")

export function visibleText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
}

export function paragraphs(html: string): string[] {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => visibleText(m[1]))
    .filter((p) => p.split(/\s+/).length >= 25)
}

function parse(page: Page): Parsed {
  const body = page.html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
  const inline = [...page.html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n")
  return {
    html: page.html,
    css: `${inline}\n${page.css}`,
    text: visibleText(page.html),
    classes: [...body.matchAll(/\bclass(?:Name)?="([^"]*)"/g)]
      .map((m) => m[1])
      .join(" "),
    headings: [...body.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(
      (m) => visibleText(m[1])
    ),
    links: [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(
      (m) => `${m[1]} ${visibleText(m[2])}`
    ),
  }
}

const PURPLE_CLASS =
  /\b(?:bg|text|from|via|to|border|ring|fill)-(?:purple|violet|indigo|fuchsia)-\d{2,3}\b/g
const PURPLE_HEX =
  /#(?:7c3aed|8b5cf6|a855f7|9333ea|6366f1|4f46e5|a78bfa|c084fc|6d28d9|5b21b6)\b/gi
const DARK =
  /\bbg-(?:black|zinc-950|neutral-950|gray-950|slate-950)\b|background(?:-color)?:\s*(?:#000\b|#000000|#09090b|#0a0a0a|black)/i
const PASTEL =
  /\bbg-(pink|purple|blue|green|yellow|orange|rose|sky|emerald|amber|violet|teal|lime|cyan|indigo|fuchsia|red)-(?:50|100)\b/g
const HUES =
  /\b(?:from|via|to)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g

export const CHECKS: Check[] = [
  {
    id: "em-dash",
    group: "Copy",
    title: "Em dashes",
    test: ({ text }) => {
      const n = count(/—/g, text)
      return n >= 2 ? `${plural(n, "em dash", "em dashes")} in the copy` : null
    },
  },
  {
    id: "not-x-its-y",
    group: "Copy",
    title: `"It's not X, it's Y"`,
    test: ({ text }) => {
      const m =
        text.match(
          /\b(?:it'?s|this is|that'?s|it isn'?t|this isn'?t)\s+not\s+(?:just\s+|only\s+)?[^.!?]{1,50}?[,;—:-]\s*(?:it'?s|this is|but)\b[^.!?]{0,40}/i
        ) ?? text.match(/\bnot\s+just\s+[^.!?,]{1,40},?\s+but\s+[^.!?]{1,40}/i)
      return m ? `"${m[0].trim().slice(0, 90)}"` : null
    },
  },
  {
    id: "checkmarks",
    group: "Copy",
    title: "Checkmark bullets",
    test: ({ text, html }) => {
      const n =
        count(/[✓✔✅☑]/g, text) +
        count(/\blucide-(?:circle-)?check(?:-circle)?\b/g, html)
      return n >= 3 ? `${plural(n, "checkmark")} used as bullets` : null
    },
  },
  {
    id: "emojis",
    group: "Copy",
    title: "Emojis",
    test: ({ text, headings }) => {
      const inHeadings = headings.filter((h) =>
        /\p{Extended_Pictographic}/u.test(h)
      )
      const n = count(/\p{Extended_Pictographic}/gu, text)
      if (inHeadings.length)
        return `in ${plural(inHeadings.length, "heading")}, e.g. "${inHeadings[0].slice(0, 60)}"`
      return n >= 5 ? `${plural(n, "emoji")} in the copy` : null
    },
  },
  {
    id: "fonts",
    group: "Type and icons",
    title: "Inter, Geist or Space Grotesk",
    test: ({ html, css }) => {
      const found = new Set<string>()
      for (const m of `${css} ${html}`.matchAll(
        /font-family:[^;}"]*?\b(Inter|Geist|Space Grotesk)\b|fonts\.googleapis\.com\/css2?\?[^"']*family=(Inter|Geist|Space\+Grotesk)\b|__(Inter|Geist|Space_Grotesk)_[a-z0-9]+/g
      ))
        found.add((m[1] ?? m[2] ?? m[3]).replace(/[+_]/g, " "))
      return found.size ? `uses ${[...found].join(", ")}` : null
    },
  },
  {
    id: "lucide",
    group: "Type and icons",
    title: "Lucide icons",
    test: ({ html }) => {
      const n = count(/<svg\b[^>]*\bclass="[^"]*\blucide\b/g, html)
      return n >= 3 ? `${plural(n, "Lucide icon")}` : null
    },
  },
  {
    id: "sparkles",
    group: "Type and icons",
    title: "Sparkle icons",
    test: ({ html, text }) => {
      const n = count(/\blucide-sparkles?\b/g, html) + count(/✨/g, text)
      return n ? `${plural(n, "sparkle")}` : null
    },
  },
  {
    id: "gradients",
    group: "Surfaces",
    title: "Gradients",
    test: ({ css, classes }) => {
      const n =
        count(/linear-gradient\(/g, css) +
        count(/\bbg-(?:gradient|linear)-to-[a-z]{1,2}\b/g, classes) +
        count(/\bbg-clip-text\b/g, classes)
      return n >= 3 ? `${plural(n, "gradient")}` : null
    },
  },
  {
    id: "orbs",
    group: "Surfaces",
    title: "Radial orbs",
    test: ({ css, classes }) => {
      const n =
        count(/\bblur-(?:2xl|3xl|\[\d{2,3}px\])\b/g, classes) +
        count(/filter:\s*blur\((?:[4-9]\d|\d{3})px\)/g, css)
      return n ? `${plural(n, "blurred blob")}` : null
    },
  },
  {
    id: "shadows",
    group: "Surfaces",
    title: "Drop shadows",
    test: ({ css, classes }) => {
      const n =
        count(/\bshadow-(?:md|lg|xl|2xl)\b/g, classes) +
        count(/box-shadow:\s*(?!none|0 0 0)[^;}]*\d+px[^;}]*\d+px/g, css)
      return n >= 5 ? `${plural(n, "shadow")}` : null
    },
  },
  {
    id: "glass",
    group: "Surfaces",
    title: "Liquid glass",
    test: ({ css, classes }) => {
      const n =
        count(/\bbackdrop-blur(?:-[a-z0-9]+)?\b/g, classes) +
        count(/backdrop-filter:\s*blur/g, css)
      return n ? `${plural(n, "frosted surface")}` : null
    },
  },
  {
    id: "radius",
    group: "Surfaces",
    title: "Soft corner radius",
    test: ({ css, classes }) => {
      const n =
        count(/\brounded-(?:2xl|3xl)\b/g, classes) +
        count(/border-radius:\s*(?:1[6-9]|[2-9]\d)px/g, css)
      return n >= 5 ? `${plural(n, "large rounded corner")}` : null
    },
  },
  {
    id: "left-stripe",
    group: "Surfaces",
    title: "Coloured left stripe",
    test: ({ css, classes }) => {
      const n =
        count(/\bborder-l-(?:[2-8]|\[\d+px\])\b/g, classes) +
        count(/border-left:\s*[2-8]px\s+solid/g, css)
      return n ? `${plural(n, "left stripe")}` : null
    },
  },
  {
    id: "dot-grid",
    group: "Surfaces",
    title: "Dot grids",
    test: ({ css, classes }) => {
      const n =
        count(/radial-gradient\([^)]*\b1px\b[^)]*\)/g, css) +
        count(/\b(?:bg-dot|dot-pattern|bg-grid)\b/g, classes)
      return n ? `${plural(n, "dot or grid pattern")}` : null
    },
  },
  {
    id: "purple-black",
    group: "Colour",
    title: "Purple and black",
    test: ({ css, classes, html }) => {
      const n = count(PURPLE_CLASS, classes) + count(PURPLE_HEX, css)
      return n >= 3 && DARK.test(`${classes} ${css} ${html.slice(0, 4000)}`)
        ? `${plural(n, "purple accent")} on a black page`
        : null
    },
  },
  {
    id: "neon",
    group: "Colour",
    title: "Neon colours",
    test: ({ css, classes }) => {
      const n =
        count(/text-shadow:\s*0\s+0\s+\d+px/g, css) +
        count(/\bdrop-shadow-\[0_0_\d+px/g, classes) +
        count(/\b(?:text|bg)-(?:lime|cyan|fuchsia)-(?:300|400)\b/g, classes)
      return n >= 3 ? `${plural(n, "glowing or neon accent")}` : null
    },
  },
  {
    id: "rainbow",
    group: "Colour",
    title: "Rainbow colouring",
    test: ({ classes }) => {
      const hues = new Set([...classes.matchAll(HUES)].map((m) => m[1]))
      return hues.size >= 5 ? `gradients across ${hues.size} hues` : null
    },
  },
  {
    id: "pastel",
    group: "Colour",
    title: "Basic pastel colours",
    test: ({ classes }) => {
      const hues = new Set([...classes.matchAll(PASTEL)].map((m) => m[1]))
      return hues.size >= 4 ? `pastel fills in ${hues.size} hues` : null
    },
  },
  {
    id: "pure-white",
    group: "Colour",
    title: "Pure white background",
    test: ({ css, html }) => {
      const body = html.match(/<body\b[^>]*>/i)?.[0] ?? ""
      const white =
        /\bbg-white\b/.test(body) ||
        /(?:^|[}\s])(?:html|body)\s*\{[^}]*background(?:-color)?:\s*(?:#fff\b|#ffffff\b|white\b|rgb\(255,\s*255,\s*255\))/i.test(
          css
        )
      return white ? "the page background is #ffffff" : null
    },
  },
  {
    id: "three-cards",
    group: "Layout",
    title: "Three feature cards in a row",
    test: ({ classes }) => {
      const n = count(/\b(?:sm:|md:|lg:)?grid-cols-3\b/g, classes)
      return n ? `${plural(n, "three-column grid")}` : null
    },
  },
  {
    id: "bento",
    group: "Layout",
    title: "Bento grids",
    test: ({ classes }) => {
      const spans = count(/\b(?:md:|lg:)?(?:col|row)-span-2\b/g, classes)
      return spans >= 2 || /\bbento\b/i.test(classes)
        ? `${plural(spans, "spanning tile")}`
        : null
    },
  },
  {
    id: "pricing",
    group: "Layout",
    title: "Three pricing tiers",
    test: ({ text }) => {
      const n = count(/\$\s?\d+(?:\.\d{2})?\s*\/\s*(?:mo|month|user)\b/gi, text)
      return n >= 3 ? `${plural(n, "monthly price")}` : null
    },
  },
  {
    id: "terminal",
    group: "Layout",
    title: "Terminal window",
    test: ({ html }) => {
      const m = html.match(
        /bg-(?:red|rose)-[45]00[\s\S]{0,300}?bg-(?:yellow|amber)-[34]00[\s\S]{0,300}?bg-(?:green|emerald)-[45]00/
      )
      return m ? "red, yellow and green window dots" : null
    },
  },
  {
    id: "arrows",
    group: "Layout",
    title: "Animated arrows",
    test: ({ classes }) => {
      const n = count(/\bgroup-hover:translate-x-(?:0\.5|1|2)\b/g, classes)
      return n ? `${plural(n, "arrow")} that slide on hover` : null
    },
  },
  {
    id: "hover",
    group: "Layout",
    title: "Hover animations",
    test: ({ classes }) => {
      const n = count(
        /\bhover:(?:scale-\d+|-translate-y-[\d.]+|rotate-\d+)\b/g,
        classes
      )
      return n >= 3
        ? `${plural(n, "element")} that grow or lift on hover`
        : null
    },
  },
  {
    id: "no-terms",
    group: "Trust",
    title: "No terms of service",
    test: ({ links }) =>
      links.some((l) => /terms|\btos\b/i.test(l))
        ? null
        : "no link to terms found",
  },
  {
    id: "no-privacy",
    group: "Trust",
    title: "No privacy policy",
    test: ({ links }) =>
      links.some((l) => /privacy/i.test(l))
        ? null
        : "no link to a privacy policy found",
  },
]

export function audit(page: Page): Finding[] {
  const parsed = parse(page)
  return CHECKS.map(({ id, group, title, test }) => {
    const evidence = test(parsed)
    return {
      id,
      group,
      title,
      hit: evidence !== null,
      evidence: evidence ?? "",
    }
  })
}
