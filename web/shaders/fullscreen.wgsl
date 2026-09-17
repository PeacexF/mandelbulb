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
  hit_pos: vec3f,
};

// Epsilon grows with distance travelled, matched to the world-space size of
// one pixel at that distance: once we're within a pixel's footprint of the
// surface, tighter precision is invisible and just costs extra steps.
fn adaptive_epsilon(base_epsilon: f32, t: f32) -> f32 {
  let tan_half_fov = tan(uniforms.resolution_time.w * 0.5);
  let pixel_angular_size = 2.0 * tan_half_fov / uniforms.resolution_time.y;
  return max(base_epsilon, pixel_angular_size * t);
}

// Exact (Knuth) sum of two f32s: returns the rounded sum plus the rounding
// error that a plain f32 addition would have discarded.
fn two_sum(a: f32, b: f32) -> vec2f {
  let s = a + b;
  let v = s - a;
  let err = (a - (s - v)) + (b - v);
  return vec2f(s, err);
}

// Reconstructs an absolute world position from a camera-relative offset.
// The camera position is carried as an f32 (hi, lo) pair (see renderer.ts),
// and two_sum recovers the rounding error a plain f32 add would lose when
// combining a large-magnitude camera coordinate with a small local offset.
// WGSL has no f64, so this double-single trick is the practical ceiling
// short of arbitrary precision. See docs/precision.md.
fn world_pos(local_offset: vec3f) -> vec3f {
  let camera_hi = uniforms.camera_pos_power.xyz;
  let camera_lo = uniforms.camera_pos_lo.xyz;

  let sx = two_sum(camera_hi.x, local_offset.x);
  let sy = two_sum(camera_hi.y, local_offset.y);
  let sz = two_sum(camera_hi.z, local_offset.z);

  return vec3f(
    sx.x + (sx.y + camera_lo.x),
    sy.x + (sy.y + camera_lo.y),
    sz.x + (sz.y + camera_lo.z),
  );
}

fn ray_march(rd: vec3f) -> MarchResult {
  let max_steps = i32(uniforms.camera_forward_maxsteps.w);
  let base_epsilon = uniforms.epsilon_maxdistance.x;
  let max_distance = uniforms.epsilon_maxdistance.y;

  var t = 0.0;

  for (var i = 0; i < max_steps; i = i + 1) {
    let p = world_pos(rd * t);
    let d = mandelbulb_de(p);

    if (d < adaptive_epsilon(base_epsilon, t)) {
      return MarchResult(true, t, f32(i), p);
    }

    t = t + d;

    if (t > max_distance) {
      return MarchResult(false, t, f32(i), p);
    }
  }

  return MarchResult(false, t, f32(max_steps), world_pos(rd * t));
}

fn soft_shadow(ro: vec3f, rd: vec3f) -> f32 {
  let k = uniforms.shading_extra.y;
  let max_distance = uniforms.epsilon_maxdistance.y;

  var result = 1.0;
  var t = 0.01;

  for (var i = 0; i < 32; i = i + 1) {
    let d = mandelbulb_de(ro + rd * t);
    if (d < 0.0001) {
      return 0.0;
    }
    result = min(result, k * d / t);
    t = t + clamp(d, 0.005, 0.5);
    if (t > max_distance) {
      break;
    }
  }

  return clamp(result, 0.0, 1.0);
}

fn ambient_occlusion(pos: vec3f, normal: vec3f) -> f32 {
  var occlusion = 0.0;
  var scale = 1.0;

  for (var i = 1; i <= 5; i = i + 1) {
    let h = 0.02 * f32(i);
    let d = mandelbulb_de(pos + normal * h);
    occlusion = occlusion + (h - d) * scale;
    scale = scale * 0.6;
  }

  return clamp(1.0 - occlusion, 0.0, 1.0);
}

fn shade(pos: vec3f, rd: vec3f, normal: vec3f) -> vec3f {
  let light_dir = normalize(uniforms.light_dir_ambient.xyz);
  let ambient = uniforms.light_dir_ambient.w;
  let light_color = uniforms.light_color_specular.xyz;
  let specular_intensity = uniforms.light_color_specular.w;
  let shininess = uniforms.shading_extra.x;
  let ao_intensity = uniforms.display_params.w;

  let diffuse = max(dot(normal, light_dir), 0.0);

  let view_dir = normalize(-rd);
  let half_dir = normalize(light_dir + view_dir);
  let specular = pow(max(dot(normal, half_dir), 0.0), shininess) * specular_intensity;

  let shadow = soft_shadow(pos + normal * 0.001, light_dir);
  let ao = mix(1.0, ambient_occlusion(pos, normal), ao_intensity);

  let lit = light_color * (diffuse + specular) * shadow;
  return (lit + vec3f(ambient)) * ao;
}

fn tonemap(color: vec3f) -> vec3f {
  let exposure = uniforms.display_params.x;
  let gamma = uniforms.display_params.y;
  let exposed = color * exposure;
  return pow(max(exposed, vec3f(0.0)), vec3f(1.0 / gamma));
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let res = uniforms.resolution_time.xy;
  let aspect = res.x / res.y;
  let ndc = vec2f((in.uv.x * 2.0 - 1.0) * aspect, in.uv.y * 2.0 - 1.0);

  let camera_right = uniforms.camera_right_iterations.xyz;
  let camera_up = uniforms.camera_up_bailout.xyz;
  let camera_forward = uniforms.camera_forward_maxsteps.xyz;
  let fov = uniforms.resolution_time.w;
  let tan_half_fov = tan(fov * 0.5);

  let rd = normalize(
    camera_forward + camera_right * ndc.x * tan_half_fov + camera_up * ndc.y * tan_half_fov,
  );

  let result = ray_march(rd);

  if (result.hit) {
    let pos = result.hit_pos;
    let normal_h = max(1e-6, adaptive_epsilon(uniforms.epsilon_maxdistance.x, result.distance) * 0.5);
    let normal = mandelbulb_normal(pos, normal_h);
    let color = shade(pos, rd, normal);

    let fog_density = uniforms.display_params.z;
    let fog_factor = clamp(1.0 - exp(-fog_density * result.distance), 0.0, 1.0);
    let fogged = mix(color, uniforms.fog_color.rgb, fog_factor);

    return vec4f(tonemap(fogged), 1.0);
  }

  let sky = mix(uniforms.fog_color.rgb, vec3f(0.0, 0.0, 0.0), ndc.y * 0.5 + 0.5);
  return vec4f(tonemap(sky), 1.0);
}
