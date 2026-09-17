struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );

  var out: VertexOut;
  let p = positions[vertex_index];
  out.position = vec4f(p, 0.0, 1.0);
  out.uv = p * 0.5 + vec2f(0.5, 0.5);
  return out;
}

struct MarchResult {
  hit: bool,
  distance: f32,
  steps: f32,
};

fn ray_march(ro: vec3f, rd: vec3f) -> MarchResult {
  let power = uniforms.camera_pos_power.w;
  let iterations = i32(uniforms.camera_right_iterations.w);
  let bailout = uniforms.camera_up_bailout.w;
  let max_steps = i32(uniforms.camera_forward_maxsteps.w);
  let epsilon = uniforms.epsilon_maxdistance.x;
  let max_distance = uniforms.epsilon_maxdistance.y;

  var t = 0.0;

  for (var i = 0; i < max_steps; i = i + 1) {
    let p = ro + rd * t;
    let d = mandelbulb_de(p, power, iterations, bailout);

    if (d < epsilon) {
      return MarchResult(true, t, f32(i));
    }

    t = t + d;

    if (t > max_distance) {
      return MarchResult(false, t, f32(i));
    }
  }

  return MarchResult(false, t, f32(max_steps));
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let res = uniforms.resolution_time.xy;
  let aspect = res.x / res.y;
  let ndc = vec2f((in.uv.x * 2.0 - 1.0) * aspect, in.uv.y * 2.0 - 1.0);

  let camera_pos = uniforms.camera_pos_power.xyz;
  let camera_right = uniforms.camera_right_iterations.xyz;
  let camera_up = uniforms.camera_up_bailout.xyz;
  let camera_forward = uniforms.camera_forward_maxsteps.xyz;
  let fov = uniforms.resolution_time.w;
  let tan_half_fov = tan(fov * 0.5);

  let rd = normalize(
    camera_forward + camera_right * ndc.x * tan_half_fov + camera_up * ndc.y * tan_half_fov,
  );

  let result = ray_march(camera_pos, rd);
  let max_steps = f32(i32(uniforms.camera_forward_maxsteps.w));

  if (result.hit) {
    let shade = 1.0 - clamp(result.steps / max_steps, 0.0, 1.0);
    return vec4f(vec3f(shade), 1.0);
  }

  let sky = mix(vec3f(0.02, 0.02, 0.05), vec3f(0.0, 0.0, 0.0), ndc.y * 0.5 + 0.5);
  return vec4f(sky, 1.0);
}
