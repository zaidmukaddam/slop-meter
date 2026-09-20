import type { Model } from "./weights.ts"

export function forward(
  model: Model,
  z: Float32Array
): { logits: Float32Array; hidden: Float32Array[] } {
  const hidden: Float32Array[] = []
  let h = z
  model.layers.forEach((l, li) => {
    const y = new Float32Array(l.outputs)
    for (let o = 0; o < l.outputs; o++) {
      let acc = 0
      const row = o * l.inputs
      for (let i = 0; i < l.inputs; i++) acc += l.q[row + i] * h[i]
      const v = acc * l.scales[o] + l.bias[o]
      y[o] = li < model.layers.length - 1 ? Math.max(v, 0) : v
    }
    if (li < model.layers.length - 1) hidden.push(y)
    h = y
  })
  return { logits: h, hidden }
}

export function gradient(
  model: Model,
  hidden: Float32Array[],
  cls: number
): Float32Array {
  const L = model.layers
  const last = L[L.length - 1]
  let g = new Float32Array(last.inputs)
  for (let o = 0; o < last.outputs; o++) {
    const coef = (o === cls ? 1 : 0) - 1 / last.outputs
    for (let i = 0; i < last.inputs; i++)
      g[i] += coef * last.q[o * last.inputs + i] * last.scales[o]
  }
  for (let li = L.length - 2; li >= 0; li--) {
    const l = L[li]
    const mask = hidden[li]
    const gi = new Float32Array(l.inputs)
    for (let o = 0; o < l.outputs; o++) {
      if (mask[o] <= 0) continue
      const go = g[o] * l.scales[o]
      for (let i = 0; i < l.inputs; i++) gi[i] += go * l.q[o * l.inputs + i]
    }
    g = gi
  }
  return g
}

export function cpuRun(
  model: Model,
  inputs: Float32Array,
  count: number
): Float32Array {
  const dim = model.layers[0].inputs
  const logits = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const row = inputs.subarray(i * dim, (i + 1) * dim)
    logits.set(forward(model, row).logits, i * 3)
  }
  return logits
}

export function softmax(logits: ArrayLike<number>, T: number): number[] {
  const m = Math.max(...Array.from(logits))
  const e = Array.from(logits, (v) => Math.exp((v - m) / T))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}
