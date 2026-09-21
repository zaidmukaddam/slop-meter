"use client"

import { toLmError } from "@slop/lm/device"
import type { LmError } from "@slop/lm/spec"
import lmManifest from "@slop/model/lm/manifest.json"
import { useSyncExternalStore } from "react"
import type { WorkerCall, WorkerReply } from "./lm-worker"
import { fetchBin, loadScorer } from "./model"

const REMEMBER = "slop-meter:sharper"
const STARTING = "slop-meter:sharper-running"
const DOWNLOAD_BYTES = 121_000_000
const CACHE_LIMIT = 2000

export type SharperState = {
  status: "off" | "loading" | "on" | "failed"
  progress: number
  msPerParagraph: number | null
  error: LmError | null
  ready: number
  held: boolean
}

const OFF: SharperState = {
  status: "off",
  progress: 0,
  msPerParagraph: null,
  error: null,
  ready: 0,
  held: false,
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

const armed = {
  set: () => localStorage.setItem(STARTING, "1"),
  clear: () => {
    try {
      localStorage.removeItem(STARTING)
    } catch {}
  },
}

const GOODBYE_MS = 1200

let resuming = false
let checking = false

export function resume(): void {
  void held()
  if (resuming) return
  resuming = true
  try {
    if (!localStorage.getItem(STARTING)) return again()
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
  window.addEventListener("pagehide", () => {
    armed.clear()
    if (!connection) return
    stop()
    update({ status: "off", progress: 0, error: null })
  })
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return
    try {
      again()
    } catch {}
  })
}

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
  if (checking) return
  checking = true
  await held()
  checking = false
  update({ status: "loading", progress: 0, error: null })
  remember(true)
  try {
    armed.set()
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
