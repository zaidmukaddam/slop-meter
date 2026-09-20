"use client"

import { toLmError } from "@slop/lm/device"
import type { LmError } from "@slop/lm/spec"
import lmManifest from "@slop/model/lm/manifest.json"
import { useSyncExternalStore } from "react"
import type { WorkerCall, WorkerReply } from "./lm-worker"
import { fetchBin, loadScorer } from "./model"

const REMEMBER = "slop-meter:sharper"
const STARTING = "slop-meter:sharper-running"
/** SmolLM2-135M in q4f16 with its tokenizer: what the first run fetches. */
const DOWNLOAD_BYTES = 121_000_000
const CACHE_LIMIT = 2000

export type SharperState = {
  status: "off" | "loading" | "on" | "failed"
  progress: number
  msPerParagraph: number | null
  error: LmError | null
  ready: number
  /** Whether the language model is already in this browser's cache, so turning
   *  sharper reading on costs a load rather than a download. */
  held: boolean
  /** This device can't carry it, so it isn't offered: see tooSmall. */
  unfit: boolean
}

const OFF: SharperState = {
  status: "off",
  progress: 0,
  msPerParagraph: null,
  error: null,
  ready: 0,
  held: false,
  unfit: false,
}
let state = OFF
const listeners = new Set<() => void>()
const features = new Map<string, Float32Array>()
const requested = new Set<string>()

type Done = Extract<WorkerReply, { type: "done" }>

class Connection {
  private worker = new Worker(new URL("./lm-worker.ts", import.meta.url), {
    type: "module",
  })
  private pending = new Map<
    number,
    { resolve: (reply: Done) => void; reject: (error: LmError) => void }
  >()
  private nextId = 0
  private furthest = 0

  constructor(onProgress: (share: number) => void) {
    this.worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      if (data.type === "progress") {
        // The total only counts files whose download has begun, and the small ones
        // finish before the 118 MB one is even announced: taken at face value that is
        // 100%, then 6%. Measured against the known size, and never allowed to fall.
        const share = data.loaded / Math.max(data.total, DOWNLOAD_BYTES)
        this.furthest = Math.max(this.furthest, Math.min(share, 1))
        onProgress(this.furthest)
        return
      }
      const call = this.pending.get(data.id)
      this.pending.delete(data.id)
      if (data.type === "done") call?.resolve(data)
      else call?.reject(data.error)
    }
  }

  call(request: WorkerCall): Promise<Done> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ ...request, id })
    })
  }

  close(): void {
    this.worker.terminate()
    for (const { reject } of this.pending.values()) {
      reject({ message: "stopped", retry: true })
    }
  }
}

let connection: Connection | null = null

function update(next: Partial<SharperState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(REMEMBER, "on")
    else localStorage.removeItem(REMEMBER)
  } catch {}
}

/** Sharper reading keeps about 800 MB in the tab. A phone or tablet gives one tab a
 *  fraction of that, and the browser's answer to running out is to kill the page. No API
 *  reports the ceiling on Safari, so this goes by the kind of device: touch first, no
 *  hover. Chrome does report memory, and under 4 GB is the same story. */
function tooSmall(): boolean {
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  return (
    (memory !== undefined && memory < 4) ||
    matchMedia("(pointer: coarse) and (hover: none)").matches
  )
}

/** Set for as long as the language model is running, cleared when it is turned off or
 *  the page leaves normally. Finding it on arrival means the tab went down with the
 *  model in it. Held the whole time and not just during start-up, because the memory
 *  peak comes with the first big batch, not with loading. */
const armed = {
  set: () => localStorage.setItem(STARTING, "1"),
  clear: () => {
    try {
      localStorage.removeItem(STARTING)
    } catch {}
  },
}

/** How long the page being left gets to say goodbye. Measured in Safari 27: a reload
 *  hydrates the new page and reads storage before the old page's pagehide has run,
 *  and that pagehide is visible here about 380 ms after navigation starts. Reading the
 *  marker once, straight away, called every ordinary reload a crash. */
const GOODBYE_MS = 1200

let resuming = false
let checking = false

export function resume(): void {
  void held()
  if (resuming) return
  resuming = true
  try {
    if (tooSmall()) {
      remember(false)
      update({ unfit: true })
      return
    }
    if (!localStorage.getItem(STARTING)) return again()
    // Without this the preference is a trap: the page dies, reloads, remembers that
    // sharper reading was on, starts it, and dies again, downloading 125 MB each lap
    // because a download the crash interrupted never reaches the cache.
    setTimeout(() => {
      try {
        if (!localStorage.getItem(STARTING)) return again()
        armed.clear()
        remember(false)
        update({
          status: "failed",
          error: {
            message: "it didn't shut down cleanly last time, so it's off",
            retry: true,
          },
        })
      } catch {}
    }, GOODBYE_MS)
  } catch {}
}

function again() {
  if (localStorage.getItem(REMEMBER) === "on") void turnOn()
}

if (typeof window !== "undefined") {
  // A page that leaves normally is not a crash. pagehide doesn't fire for one that is.
  window.addEventListener("pagehide", armed.clear)
  // Safari parks the page it leaves in the back-forward cache, model and all. Coming
  // back to it, the marker pagehide removed has to go up again.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return
    if (state.status === "on" || state.status === "loading") {
      try {
        armed.set()
      } catch {}
    }
  })
}

/** transformers.js keeps model files in a Cache Storage bucket of its own, so the
 *  download happens once per browser. Asking it turns "42%" into a straight answer
 *  about whether anything is coming over the network at all. */
async function held(): Promise<void> {
  try {
    const cache = await caches.open("transformers-cache")
    const keys = await cache.keys()
    const name = lmManifest.lm.repo.split("/").pop() ?? ""
    update({ held: keys.some((request) => request.url.includes(name)) })
  } catch {}
}

export async function turnOn(): Promise<void> {
  if (state.status === "on" || state.status === "loading") return
  if (state.unfit || checking) return
  // Know whether this is a download or a start before saying which. Half a second of
  // "Downloading, 0%" on every reload is how a cached model gets a reputation for
  // downloading itself again.
  checking = true
  await held()
  checking = false
  update({ status: "loading", progress: 0, error: null })
  remember(true)
  try {
    armed.set()
    // Asks the browser not to evict the 125 MB it is about to keep. Safari decides
    // from how the site is used and may say no, which costs nothing.
    void navigator.storage?.persist?.()
  } catch {}
  const lm = new Connection((progress) => update({ progress }))
  connection = lm
  try {
    const [scorer, weights] = await Promise.all([
      loadScorer(),
      fetchBin("/model-lm.bin"),
      lm.call({ type: "load" }),
    ])
    if (connection !== lm) return
    scorer.useLm(lmManifest, weights)
    update({ status: "on", progress: 1 })
    void held()
  } catch (error) {
    if (connection === lm) fail(error)
  }
}

export function turnOff(): void {
  remember(false)
  armed.clear()
  stop()
  update({ status: "off", progress: 0, error: null })
}

function fail(error: unknown) {
  armed.clear()
  stop()
  const lmError = isLmError(error) ? error : toLmError(error)
  update({ status: "failed", error: lmError })
}

function stop() {
  connection?.close()
  connection = null
  requested.clear()
  void loadScorer().then((scorer) => scorer.dropLm())
}

const isLmError = (error: unknown): error is LmError =>
  typeof (error as LmError)?.retry === "boolean"

export function request(texts: string[]): void {
  const lm = connection
  if (state.status !== "on" || !lm) return
  const missing = [...new Set(texts)].filter(
    (text) => !features.has(text) && !requested.has(text)
  )
  if (!missing.length) return
  missing.forEach((text) => requested.add(text))
  const started = performance.now()
  lm.call({ type: "features", texts: missing }).then(
    (reply) => {
      if (connection !== lm) return
      if (features.size + missing.length > CACHE_LIMIT) features.clear()
      missing.forEach((text, i) => {
        features.set(text, reply.features[i])
        requested.delete(text)
      })
      update({
        ready: state.ready + missing.length,
        msPerParagraph: (performance.now() - started) / missing.length,
      })
    },
    (error) => {
      if (connection === lm) fail(error)
    }
  )
}

export function featuresFor(
  sharper: SharperState,
  text: string
): Float32Array | undefined {
  return sharper.status === "on" ? features.get(text) : undefined
}

export function useSharper(): SharperState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => OFF
  )
}
