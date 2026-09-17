fn mandelbulb_de(pos: vec3f) -> f32 {
  let power = uniforms.camera_pos_power.w;
  let iterations = i32(uniforms.camera_right_iterations.w);
  let bailout = uniforms.camera_up_bailout.w;

  var z = pos;
  var dr = 1.0;
  var r = 0.0;

  for (var i = 0; i < iterations; i = i + 1) {
    r = length(z);
    if (r > bailout) {
      break;
    }

    var theta = 0.0;
    var phi = 0.0;
    if (r > 1e-12) {
      theta = acos(clamp(z.z / r, -1.0, 1.0));
      phi = atan2(z.y, z.x);
    }
    dr = pow(r, power - 1.0) * power * dr + 1.0;

    let zr = pow(r, power);
    theta = theta * power;
    phi = phi * power;

    z = zr * vec3f(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
    z = z + pos;
  }

  if (r < 1e-12) {
    return 0.0;
  }
  return 0.5 * log(r) * r / dr;
}

// Tetrahedral gradient estimate: 4 taps instead of the 6 a central-difference
// scheme needs, using the fact that any 4 non-coplanar directions are enough
// to recover a 3D gradient (Quilez's distance-field normal trick).
fn mandelbulb_normal(pos: vec3f) -> vec3f {
  let h = 0.0001;
  let k0 = vec3f(1.0, -1.0, -1.0);
  let k1 = vec3f(-1.0, -1.0, 1.0);
  let k2 = vec3f(-1.0, 1.0, -1.0);
  let k3 = vec3f(1.0, 1.0, 1.0);

  return normalize(
    k0 * mandelbulb_de(pos + k0 * h) +
    k1 * mandelbulb_de(pos + k1 * h) +
    k2 * mandelbulb_de(pos + k2 * h) +
    k3 * mandelbulb_de(pos + k3 * h),
  );
}
