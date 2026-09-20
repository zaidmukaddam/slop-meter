"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BATCH, type BenchmarkResult, runBenchmark } from "@/lib/benchmark"
import { EXAMPLES } from "@/lib/examples"

const ms = (x: number) => `${x < 10 ? x.toFixed(1) : Math.round(x)} ms`

export function EngineCheck() {
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function test() {
    setRunning(true)
    setError(null)
    try {
      setResult(await runBenchmark(EXAMPLES.map((e) => e.text)))
    } catch (cause) {
      setError(String(cause))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <dl
        aria-live="polite"
        className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2"
      >
        <Row
          name="CPU"
          value={result ? ms(result.cpuMs) : "–"}
          detail={`${BATCH} paragraphs, one at a time`}
        />
        <Row
          name="WebGPU"
          value={
            !result ? "–" : result.gpu.available ? ms(result.gpu.ms) : "off"
          }
          detail={
            !result
              ? "the same paragraphs in one batch"
              : result.gpu.available
                ? `matches the CPU to ${result.gpu.maxLogitDelta.toExponential(1)}`
                : result.gpu.reason
          }
        />
      </dl>
      <div className="space-y-4">
        <Button
          onClick={test}
          disabled={running}
          className="h-10 rounded-full px-5 text-sm"
        >
          {running ? "Testing…" : result ? "Test again" : "Test this device"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-pretty text-destructive">
            The test stopped ({error}). Reload the page to try again.
          </p>
        )}
      </div>
    </div>
  )
}

function Row({
  name,
  value,
  detail,
}: {
  name: string
  value: string
  detail: string
}) {
  return (
    <div className="bg-sheet px-5 py-5">
      <dt className="legend text-[10px] font-semibold text-graphite">{name}</dt>
      <dd className="mt-2 font-mono text-3xl leading-none font-light tabular-nums">
        {value}
      </dd>
      <dd className="mt-2 text-[13px] text-pretty text-graphite">{detail}</dd>
    </div>
  )
}
