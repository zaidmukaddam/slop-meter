import { browser } from "wxt/browser"

export type Settings = {
  enabled: boolean
  allowlist: boolean
  sites: Record<string, boolean>
  rewrite: boolean
  rewriteNoted: boolean
  share: boolean
  lm: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  allowlist: false,
  sites: {},
  rewrite: false,
  rewriteNoted: false,
  share: false,
  lm: false,
}

const DEFAULT_OFF_DOMAINS = [
  "slop-meter.com",
  "mail.google.com",
  "proton.me",
  "protonmail.com",
  "tuta.com",
  "fastmail.com",
  "mail.yahoo.com",
  "icloud.com",
  "live.com",
  "docs.google.com",
  "drive.google.com",
  "notion.so",
  "notion.site",
  "office.com",
  "office365.com",
  "sharepoint.com",
  "dropbox.com",
  "quip.com",
  "coda.io",
  "paypal.com",
  "stripe.com",
  "venmo.com",
  "wise.com",
  "revolut.com",
  "monzo.com",
  "chase.com",
  "wellsfargo.com",
  "citi.com",
  "capitalone.com",
  "usbank.com",
  "pnc.com",
  "hsbc.com",
  "hsbc.co.uk",
  "barclays.co.uk",
  "santander.com",
  "natwest.com",
  "lloydsbank.com",
  "americanexpress.com",
  "discover.com",
  "ally.com",
  "sofi.com",
  "schwab.com",
  "fidelity.com",
  "vanguard.com",
  "coinbase.com",
  "robinhood.com",
  "n26.com",
  "ing.com",
]

const DEFAULT_OFF_PATTERN = /(^|\.)(mail|webmail|outlook)\.|bank/

export function isDefaultOff(host: string): boolean {
  const listed = DEFAULT_OFF_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  )
  return listed || DEFAULT_OFF_PATTERN.test(host)
}

export function isOnByDefault(settings: Settings, host: string): boolean {
  return !settings.allowlist && !isDefaultOff(host)
}

export function isSiteOn(settings: Settings, host: string): boolean {
  if (!settings.enabled) return false
  if (host in settings.sites) return settings.sites[host]
  return isOnByDefault(settings, host)
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTING_KEYS)
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  return browser.storage.local.set(patch)
}

export function onSettingsChanged(
  listener: (changed: Set<keyof Settings>) => void
): void {
  browser.storage.onChanged.addListener((changes, area) => {
    const changed = SETTING_KEYS.filter((key) => key in changes)
    if (area === "local" && changed.length) listener(new Set(changed))
  })
}
