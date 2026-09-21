export const STATS = 4
export const NONE = 0xffffffff

const WGSL = `
struct Shape { count: u32, vocab: u32 }
@group(0) @binding(0) var<storage, read> logits: array<f32>;
@group(0) @binding(1) var<storage, read> next: array<u32>;
@group(0) @binding(2) var<storage, read_write> stats: array<f32>;
@group(0) @binding(3) var<uniform> shape: Shape;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= shape.count) { return; }
  let token = next[i];
  if (token >= shape.vocab) { return; }
  let base = i * shape.vocab;
  var top = logits[base];
  for (var v = 1u; v < shape.vocab; v++) { top = max(top, logits[base + v]); }
  let seen = logits[base + token];
  var z = 0.0;
  var sd = 0.0;
  var sdd = 0.0;
  var rank = 1u;
  for (var block = 0u; block < shape.vocab; block += 256u) {
    var bz = 0.0;
    var bd = 0.0;
    var bdd = 0.0;
    let end = min(block + 256u, shape.vocab);
    for (var v = block; v < end; v++) {
      let x = logits[base + v];
      let d = x - top;
      let e = exp(d);
      bz += e;
      bd += e * d;
      bdd += e * d * d;
      if (x > seen) { rank++; }
    }
    z += bz;
    sd += bd;
    sdd += bdd;
  }
  let mean = sd / z;
  stats[i * 4u] = seen - top - log(z);
  stats[i * 4u + 1u] = log(z) - mean;
  stats[i * 4u + 2u] = max(sdd / z - mean * mean, 0.0);
  stats[i * 4u + 3u] = f32(rank);
}`

export class GpuStats {
  private device: GPUDevice
  private pipeline: GPUComputePipeline
  private held: GPUBuffer | null = null

  constructor(device: GPUDevice) {
    this.device = device
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: WGSL }),
        entryPoint: "main",
      },
    })
  }

  logits(bytes: number): GPUBuffer {
    if (this.held?.size === bytes) return this.held
    this.held?.destroy()
    this.held = this.device.createBuffer({
      size: bytes,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    })
    return this.held
  }

  async reduce(
    logits: GPUBuffer,
    next: Uint32Array<ArrayBuffer>,
    vocab: number
  ): Promise<Float32Array> {
    const { device } = this
    const count = next.length
    const bytes = count * STATS * 4
    const tokens = device.createBuffer({
      size: next.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    const shape = device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const stats = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    })
    const staging = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    try {
      device.queue.writeBuffer(tokens, 0, next)
      device.queue.writeBuffer(shape, 0, new Uint32Array([count, vocab]))
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginComputePass()
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(
        0,
        device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: { buffer: logits, size: count * vocab * 4 },
            },
            { binding: 1, resource: { buffer: tokens } },
            { binding: 2, resource: { buffer: stats } },
            { binding: 3, resource: { buffer: shape } },
          ],
        })
      )
      pass.dispatchWorkgroups(Math.ceil(count / 64))
      pass.end()
      encoder.copyBufferToBuffer(stats, 0, staging, 0, bytes)
      device.queue.submit([encoder.finish()])
      await staging.mapAsync(GPUMapMode.READ)
      return new Float32Array(staging.getMappedRange().slice(0))
    } finally {
      for (const buffer of [tokens, shape, stats, staging]) buffer.destroy()
    }
  }
}
