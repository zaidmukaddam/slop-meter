import KERNEL from "./kernel.wgsl.ts"
import type { Model } from "./weights.ts"

export class GpuRunner {
  private device: GPUDevice
  private pipeline: GPUComputePipeline
  private layers: {
    dims: GPUBuffer
    w: GPUBuffer
    scale: GPUBuffer
    bias: GPUBuffer
    inputs: number
    outputs: number
    relu: number
  }[]
  private constructor(
    device: GPUDevice,
    pipeline: GPUComputePipeline,
    layers: GpuRunner["layers"]
  ) {
    this.device = device
    this.pipeline = pipeline
    this.layers = layers
  }

  static async create(
    model: Model,
    gpu: GPU | undefined = globalThis.navigator?.gpu
  ): Promise<GpuRunner | null> {
    const adapter = await gpu?.requestAdapter()
    if (!adapter) return null
    const device = await adapter.requestDevice()
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: KERNEL }),
        entryPoint: "main",
      },
    })
    const upload = (data: ArrayBufferView, usage: number) => {
      const buf = device.createBuffer({
        size: Math.ceil(data.byteLength / 4) * 4,
        usage: usage | GPUBufferUsage.COPY_DST,
      })
      device.queue.writeBuffer(
        buf,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength
      )
      return buf
    }
    const layers = model.layers.map((l, i) => ({
      dims: device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
      w: upload(l.packed, GPUBufferUsage.STORAGE),
      scale: upload(l.scales, GPUBufferUsage.STORAGE),
      bias: upload(l.bias, GPUBufferUsage.STORAGE),
      inputs: l.inputs,
      outputs: l.outputs,
      relu: i < model.layers.length - 1 ? 1 : 0,
    }))
    return new GpuRunner(device, pipeline, layers)
  }

  async run(
    z: Float32Array<ArrayBuffer>,
    batch: number
  ): Promise<Float32Array> {
    const { device } = this
    const S = GPUBufferUsage.STORAGE
    const buffers: GPUBuffer[] = []
    const make = (size: number, usage: number) => {
      const b = device.createBuffer({ size: Math.max(16, size), usage })
      buffers.push(b)
      return b
    }
    let x = make(z.byteLength, S | GPUBufferUsage.COPY_DST)
    device.queue.writeBuffer(x, 0, z)
    const enc = device.createCommandEncoder()
    for (const l of this.layers) {
      device.queue.writeBuffer(
        l.dims,
        0,
        new Uint32Array([batch, l.inputs, l.outputs, l.relu])
      )
      const y = make(batch * l.outputs * 4, S | GPUBufferUsage.COPY_SRC)
      const bind = device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [l.dims, x, l.w, l.scale, l.bias, y].map(
          (buffer, binding) => ({ binding, resource: { buffer } })
        ),
      })
      const pass = enc.beginComputePass()
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, bind)
      pass.dispatchWorkgroups(Math.ceil(l.outputs / 64), batch)
      pass.end()
      x = y
    }
    const out = this.layers[this.layers.length - 1].outputs * batch * 4
    const read = make(out, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST)
    enc.copyBufferToBuffer(x, 0, read, 0, out)
    device.queue.submit([enc.finish()])
    await read.mapAsync(GPUMapMode.READ)
    const logits = new Float32Array(read.getMappedRange().slice(0))
    read.unmap()
    for (const b of buffers) b.destroy()
    return logits
  }
}
