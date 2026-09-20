import { createRoot } from "react-dom/client"
import { browser } from "wxt/browser"
import { App } from "./app"
import "./popup.css"
import { startPopupStore } from "./store"

async function targetTab(): Promise<number | undefined> {
  const forced = Number(new URLSearchParams(location.search).get("tab"))
  if (forced) return forced
  const [active] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })
  return active?.id
}

await startPopupStore(await targetTab())
createRoot(document.getElementById("root")!).render(<App />)
