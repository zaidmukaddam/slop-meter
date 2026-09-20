"use client"

import manifest from "@slop/model/manifest.json"
import { Scorer } from "@slop/model"
import { useEffect, useState } from "react"

let scorerPromise: Promise<Scorer> | null = null

export function loadScorer(): Promise<Scorer> {
  scorerPromise ??= fetchBin("/model.bin").then((weights) =>
    Scorer.create(manifest, weights)
  )
  return scorerPromise
}

export async function fetchBin(path: string): Promise<ArrayBuffer> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.arrayBuffer()
}

type ScorerState = { scorer: Scorer | null; error: string | null }

export function useScorer(): ScorerState {
  const [state, setState] = useState<ScorerState>({
    scorer: null,
    error: null,
  })
  useEffect(() => {
    loadScorer().then(
      (scorer) => setState({ scorer, error: null }),
      (error) => setState({ scorer: null, error: String(error) })
    )
  }, [])
  return state
}
