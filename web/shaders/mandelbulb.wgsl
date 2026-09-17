fn mandelbulb_de(pos: vec3f, power: f32, iterations: i32, bailout: f32) -> f32 {
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
