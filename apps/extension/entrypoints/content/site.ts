import type { SiteClass } from "@slop/model"

type PageSignals = { path: string; ogType: string; generator: string }
type SiteRule = {
  siteClass: SiteClass
  host: RegExp
  page?: (signals: PageSignals) => boolean
}

const SITE_RULES: SiteRule[] = [
  {
    siteClass: "social",
    host: /(^|\.)(twitter|x|facebook|instagram|linkedin|threads|bsky|tiktok|youtube|mastodon)\./,
  },
  {
    siteClass: "forum",
    host: /(^|\.)(reddit|quora|stackoverflow|stackexchange|ycombinator|discord)\.|^(forums?|community|discuss)\./,
    page: (signals) => /discourse/i.test(signals.generator),
  },
  {
    siteClass: "reference",
    host: /(^|\.)(wikipedia|wiktionary|wikimedia|britannica|fandom)\.|\.wiki$/,
  },
  {
    siteClass: "docs",
    host: /^(docs|developers?|devdocs|learn)\./,
    page: (signals) => /\/docs?\//.test(signals.path),
  },
  {
    siteClass: "shop",
    host: /(^|\.)(amazon|ebay|etsy|walmart|aliexpress|bestbuy|shopify)\./,
    page: (signals) => signals.ogType === "product",
  },
  {
    siteClass: "news",
    host: /(^|\.)(nytimes|bbc|cnn|theguardian|reuters|apnews|washingtonpost|wsj|bloomberg|npr|ft|economist|theverge|arstechnica|wired|axios|politico)\.|news/,
  },
  {
    siteClass: "blog",
    host: /(^|\.)(medium|substack|wordpress|blogspot|ghost|tumblr|hashnode)\.|blog/,
    page: (signals) => signals.ogType === "article",
  },
]

export function readSiteClass(): SiteClass {
  const host = location.hostname.replace(/^www\./, "")
  const signals: PageSignals = {
    path: location.pathname,
    ogType: metaContent("og:type"),
    generator: metaContent("generator"),
  }
  const match = SITE_RULES.find(
    (rule) => rule.host.test(host) || rule.page?.(signals)
  )
  return match?.siteClass ?? "other"
}

function metaContent(name: string): string {
  const selector = `meta[name="${name}"],meta[property="${name}"]`
  return document.querySelector<HTMLMetaElement>(selector)?.content ?? ""
}
