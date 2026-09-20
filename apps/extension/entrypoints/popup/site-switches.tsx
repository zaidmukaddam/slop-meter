import {
  type Settings,
  isDefaultOff,
  isOnByDefault,
} from "../../shared/settings"
import { SettingRow } from "./setting-row"
import { changeSettings } from "./store"

type Props = { settings: Settings; host: string }

export function SiteSwitches({ settings, host }: Props) {
  return (
    <section aria-labelledby="where-title">
      <h2
        id="where-title"
        className="legend mb-1 text-[10px] font-semibold text-graphite"
      >
        Where it runs
      </h2>
      {host && <ThisSite settings={settings} host={host} />}
      <SettingRow
        label="Pause on all sites"
        checked={!settings.enabled}
        onCheckedChange={(checked) => changeSettings({ enabled: !checked })}
      />
      <SettingRow
        label="Only run on sites you turn on"
        checked={settings.allowlist}
        onCheckedChange={(checked) => changeSettings({ allowlist: checked })}
      />
    </section>
  )
}

function ThisSite({ settings, host }: Props) {
  const overridden = host in settings.sites
  const on = overridden ? settings.sites[host] : isOnByDefault(settings, host)
  const offByDefault = isDefaultOff(host) && !overridden
  return (
    <SettingRow
      label={`On for ${host}`}
      description={
        offByDefault
          ? "Off by default on mail, docs, banking, and Slop Meter's own site."
          : undefined
      }
      checked={on}
      disabled={!settings.enabled}
      onCheckedChange={(checked) =>
        changeSettings({ sites: { ...settings.sites, [host]: checked } })
      }
    />
  )
}
