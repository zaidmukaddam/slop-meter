import type { LmStatus } from "@slop/lm/spec"
import type { Settings } from "../../shared/settings"
import { SettingRow } from "./setting-row"
import { changeSettings } from "./store"

function describe(on: boolean, lm: LmStatus | null): string {
  if (!on) {
    return "Adds a small language model, about 120\u00a0MB, downloaded once. It runs on this device, and your text stays here."
  }
  if (!lm || lm.status === "loading") {
    return `Downloading, ${Math.round((lm?.progress ?? 0) * 100)}%`
  }
  if (lm.status === "failed") {
    return lm.error?.retry
      ? `Couldn't start: ${lm.error.message}. Turn it off and on to try again.`
      : `${lm.error?.message}.`
  }
  return lm.msPerParagraph === null
    ? "On."
    : `On. About ${Math.round(lm.msPerParagraph)}\u00a0ms a paragraph.`
}

export function ReadingSwitch({
  settings,
  lm,
}: {
  settings: Settings
  lm: LmStatus | null
}) {
  return (
    <section aria-labelledby="reading-title">
      <h2
        id="reading-title"
        className="legend mb-1 text-[10px] font-semibold text-graphite"
      >
        How it reads
      </h2>
      <SettingRow
        label="Sharper reading"
        description={describe(settings.lm, lm)}
        checked={settings.lm}
        onCheckedChange={(checked) => changeSettings({ lm: checked })}
      />
    </section>
  )
}
