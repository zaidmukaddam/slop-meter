export default `
struct Dims { batch: u32, inputs: u32, outputs: u32, relu: u32 }

@group(0) @binding(0) var<uniform> dims: Dims;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> w: array<u32>;
@group(0) @binding(3) var<storage, read> scale: array<f32>;
@group(0) @binding(4) var<storage, read> bias: array<f32>;
@group(0) @binding(5) var<storage, read_write> y: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let o = gid.x;
  let b = gid.y;
  if (o >= dims.outputs || b >= dims.batch) { return; }
  let row = o * dims.inputs;
  let xrow = b * dims.inputs;
  var acc = 0.0;
  for (var i = 0u; i < dims.inputs; i++) {
    let k = row + i;
    let q = extractBits(bitcast<i32>(w[k >> 2u]), (k & 3u) * 8u, 8u);
    acc += f32(q) * x[xrow + i];
  }
  var v = acc * scale[o] + bias[o];
  if (dims.relu == 1u) { v = max(v, 0.0); }
  y[b * dims.outputs + o] = v;
}
`
