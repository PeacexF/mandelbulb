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

fn mandelbulb_normal(pos: vec3f) -> vec3f {
  let h = 0.0001;
  let dx = vec3f(h, 0.0, 0.0);
  let dy = vec3f(0.0, h, 0.0);
  let dz = vec3f(0.0, 0.0, h);

  return normalize(vec3f(
    mandelbulb_de(pos + dx) - mandelbulb_de(pos - dx),
    mandelbulb_de(pos + dy) - mandelbulb_de(pos - dy),
    mandelbulb_de(pos + dz) - mandelbulb_de(pos - dz),
  ));
}
