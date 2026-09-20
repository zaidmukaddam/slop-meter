import { API_HOST } from "../../shared/api"
import type { Settings } from "../../shared/settings"
import { Button } from "@/components/ui/button"
import { SettingRow } from "./setting-row"
import { changeSettings, setRewriteNoteOpen } from "./store"

type Props = {
  settings: Settings
  corrections: number
  rewriteNoteOpen: boolean
}

export function PrivacySwitches({
  settings,
  corrections,
  rewriteNoteOpen,
}: Props) {
  const onRewriteChange = (checked: boolean) => {
    if (checked && !settings.rewriteNoted) setRewriteNoteOpen(true)
    else changeSettings({ rewrite: checked })
  }

  return (
    <section aria-labelledby="sends-title">
      <h2
        id="sends-title"
        className="legend mb-1 text-[10px] font-semibold text-graphite"
      >
        What it sends
      </h2>
      <SettingRow
        label="Rewrite"
        description={`Sends a paragraph's text to ${API_HOST} when you use it.`}
        checked={settings.rewrite}
        onCheckedChange={onRewriteChange}
      />
      {rewriteNoteOpen && <RewriteNote />}
      <SettingRow
        label="Share corrections (numbers only)"
        description={`${corrections} correction${corrections === 1 ? "" : "s"} stored on this device.`}
        checked={settings.share}
        onCheckedChange={(checked) => changeSettings({ share: checked })}
      />
    </section>
  )
}

function RewriteNote() {
  return (
    <div className="mb-2 space-y-2 rounded-md bg-muted p-3 text-xs">
      <p className="text-pretty">
        Rewrite sends the paragraph's text to {API_HOST}. Everything else Slop
        Meter does stays on this device or sends numbers only.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => changeSettings({ rewrite: true, rewriteNoted: true })}
        >
          Turn on Rewrite
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setRewriteNoteOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
