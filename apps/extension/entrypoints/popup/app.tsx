import { BrandMark } from "@slop/theme/brand-mark"
import { useSyncExternalStore } from "react"
import { Separator } from "@/components/ui/separator"
import { PageSummary } from "./page-summary"
import { PrivacySwitches } from "./privacy-switches"
import { ReadingSwitch } from "./reading-switch"
import { ScoreText } from "./score-text"
import { SiteSwitches } from "./site-switches"
import { popupStore } from "./store"

const BACKEND_NAME = { webgpu: "WebGPU", cpu: "CPU" }

export function App() {
  const { settings, summary, corrections, rewriteNoteOpen, lm } =
    useSyncExternalStore(popupStore.subscribe, popupStore.getState)
  const page = typeof summary === "object" ? summary : null

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center gap-2">
        <BrandMark className="size-4" />
        <h1 className="legend text-[11px] font-semibold">Slop Meter</h1>
        {page?.on && (
          <span className="ml-auto font-mono text-[10px] text-graphite">
            Scoring on {BACKEND_NAME[page.backend]}
          </span>
        )}
      </header>
      <PageSummary summary={summary} />
      <Separator />
      <ScoreText lm={settings.lm} />
      <Separator />
      <ReadingSwitch settings={settings} lm={lm} />
      <Separator />
      <SiteSwitches settings={settings} host={page?.host ?? ""} />
      <Separator />
      <PrivacySwitches
        settings={settings}
        corrections={corrections}
        rewriteNoteOpen={rewriteNoteOpen}
      />
    </main>
  )
}
