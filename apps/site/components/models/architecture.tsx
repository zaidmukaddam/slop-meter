import sharperManifest from "@slop/model/lm/manifest.json"
import { COLOR } from "@/lib/decisions"
import { integer } from "@/lib/format"
import { MODELS } from "@/lib/models"

const [standard, sharper] = MODELS
const layersOf = (arch: string) => arch.match(/\d+/g)!.map(Number)
const LAYERS = layersOf(standard.report.model.arch)
const SHARPER_LAYERS = layersOf(sharper.report.model.arch)
const count = (prefix: string) =>
  standard.manifest.features.filter((f) => f.startsWith(prefix)).length
const RULE_SCORES = count("r-")
const FUNCTION_WORDS = count("fw:")
const { lm } = sharperManifest
const bar = (x: number) => `${Math.round(x * 100)}%`

const W = 320
const H = 170
const OUTPUTS = [COLOR.human, COLOR.mixed, COLOR.machine]

function Network({ extra = 0, label }: { extra?: number; label: string }) {
  const drawn = [9 + extra, 11, 6, 3]
  const nodes = drawn.map((n, layer) =>
    Array.from({ length: n }, (_, i) => ({
      x: 20 + (layer * (W - 40)) / (drawn.length - 1),
      y: H / 2 + (i - (n - 1) / 2) * (layer === drawn.length - 1 ? 30 : 13),
      added: layer === 0 && i >= 9,
    }))
  )
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="w-full max-w-[22rem]"
    >
      {nodes
        .slice(0, -1)
        .map((layer, l) =>
          layer.map((a, i) =>
            nodes[l + 1].map((b, j) => (
              <line
                key={`${l}-${i}-${j}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={a.added ? "var(--machine)" : "var(--etch)"}
                strokeOpacity={a.added ? 0.5 : 0.35}
                strokeWidth="0.5"
              />
            ))
          )
        )}
      {nodes.map((layer, l) =>
        layer.map((node, i) => (
          <circle
            key={`${l}-${i}`}
            cx={node.x}
            cy={node.y}
            r={l === nodes.length - 1 ? 5 : 3}
            fill={
              l === nodes.length - 1
                ? OUTPUTS[i]
                : node.added
                  ? "var(--machine)"
                  : "var(--ink)"
            }
          />
        ))
      )}
    </svg>
  )
}

const FLOW =
  "grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1fr_1fr]"
const STAGE = "border-t border-hairline pt-5"
const STEP = "legend text-[10px] font-semibold text-graphite"
const BIG =
  "mt-3 font-mono text-4xl leading-none font-light tracking-tight tabular-nums"
const NOTE = "mt-3 max-w-[17rem] text-sm text-pretty text-graphite"

export function StandardPipeline() {
  return (
    <ol className={FLOW}>
      <li className={STAGE}>
        <p className={STEP}>1 · Measure</p>
        <p className={BIG}>{integer(LAYERS[0])}</p>
        <p className={NOTE}>
          numbers from each paragraph: {RULE_SCORES} rule scores, the rate of{" "}
          {FUNCTION_WORDS} function words, and{" "}
          {LAYERS[0] - RULE_SCORES - FUNCTION_WORDS} counts of punctuation,
          sentence length and habits like contractions.
        </p>
      </li>
      <li className={STAGE}>
        <p className={STEP}>2 · Network</p>
        <div className="mt-3">
          <Network
            label={`A network of three layers: ${LAYERS.join(", then ")} numbers wide`}
          />
        </div>
        <p className="mt-2 font-mono text-sm tabular-nums">
          {LAYERS.join(" → ")}
        </p>
        <p className={NOTE}>
          Three layers and {integer(standard.manifest.params)} weights, stored
          as 8-bit integers.
        </p>
      </li>
      <li className={STAGE}>
        <p className={STEP}>3 · Odds</p>
        <div
          aria-hidden
          className="mt-4 flex h-2 max-w-[12rem] overflow-hidden rounded-full"
        >
          <span className="w-[8%]" style={{ background: COLOR.human }} />
          <span className="w-[14%]" style={{ background: COLOR.mixed }} />
          <span className="flex-1" style={{ background: COLOR.machine }} />
        </div>
        <p className={NOTE}>
          A calibration step turns the three outputs into odds that match how
          often it is right.
        </p>
      </li>
      <li className={STAGE}>
        <p className={STEP}>4 · Verdict</p>
        <p className={BIG}>{bar(standard.manifest.tauMachine)}</p>
        <p className={NOTE}>
          It says machine-ish only above this, and human-ish or mixed above{" "}
          {bar(standard.manifest.tau)}. Below that, can&apos;t tell.
        </p>
      </li>
    </ol>
  )
}

export function SharperPipeline() {
  return (
    <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_1fr]">
      <li className={STAGE}>
        <p className={STEP}>1 · Language model</p>
        <p className={BIG}>135M</p>
        <p className={NOTE}>
          SmolLM2, a small open language model, stored in 4-bit. It downloads
          once, 125 MB, and runs in the tab.
        </p>
      </li>
      <li className={STAGE}>
        <p className={STEP}>2 · Read</p>
        <p className={BIG}>{lm.features.length}</p>
        <p className={NOTE}>
          numbers from the first {lm.maxTokens} tokens. At each word it scores
          all 49,152 words it knows, and a shader on the GPU boils that down.
        </p>
      </li>
      <li className={STAGE}>
        <p className={STEP}>3 · Network</p>
        <div className="mt-3">
          <Network
            extra={2}
            label={`The same network with a wider input: ${SHARPER_LAYERS.join(", then ")}`}
          />
        </div>
        <p className="mt-2 font-mono text-sm tabular-nums">
          {SHARPER_LAYERS.join(" → ")}
        </p>
        <p className={NOTE}>
          Standard&apos;s {integer(LAYERS[0])} numbers plus the{" "}
          {lm.features.length}, in orange. {sharper.report.model.members} copies
          trained from different starts vote, {integer(sharper.manifest.params)}{" "}
          weights in all.
        </p>
      </li>
      <li className={STAGE}>
        <p className={STEP}>4 · Verdict</p>
        <p className={BIG}>{bar(sharper.manifest.tauMachine)}</p>
        <p className={NOTE}>
          Its own bars, set for the same accuracy: this for machine-ish,{" "}
          {bar(sharper.manifest.tau)} for the rest.
        </p>
      </li>
    </ol>
  )
}
