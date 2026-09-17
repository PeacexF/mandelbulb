# Precision and Deep Zoom

Notes on why 32-bit floats eventually break down when zooming into the
Mandelbulb, and the technique this renderer uses to push that limit back.

## Why precision has a limit here

WGSL has no `f64`. Every position, direction, and distance on the GPU side
is a 32-bit float: roughly 7 significant decimal digits, with a relative
rounding error (machine epsilon) of about `1.19e-7` near 1.0.

The Mandelbulb is anchored at the world origin and has a bounded size
(iteration bails out once a point's magnitude passes `bailout`, typically
2, keeping the whole shape within a sphere of radius ~1.2). Absolute
positions in this scene are therefore always close to the origin — the
classic "deep zoom breaks because you've flown a billion units from home"
problem doesn't apply here. What does apply is the opposite: resolving
detail *smaller* than an `f32` can represent at a given position's
magnitude. Once a feature's scale drops below roughly `|position| *
1.19e-7`, a plain `f32` can no longer tell it apart from its surroundings.

For a camera sitting near the surface (`|position| ~ 1`), that wall sits
around `1e-7` world units. Two symptoms show up as you approach it:

- **Ray marching**: `p = camera_pos + ray_dir * t` starts rounding away the
  contribution of `ray_dir * t` once it's small relative to `camera_pos`,
  so the distance estimator gets fed a quantized position and either
  reports a stale distance or fails to converge — visible as banding,
  stair-stepping, or a surface that stops responding to camera movement at
  extreme closeness.
- **Normals**: a finite-difference gradient needs its sample offset to be
  larger than the quantization step of the position it's sampling around,
  or both samples round to the identical `f32` value and the gradient
  collapses to zero — a black or noisy pixel.

## Compensated summation: recovering precision without f64

The camera's position is tracked in full double precision on the CPU (both
the Go state and JavaScript numbers are natively 64-bit), but it has to
cross into a 32-bit uniform to reach the shader. Rather than upload one
rounded `f32` and lose the rest, the renderer splits each coordinate into a
pair:

```
hi = fround(x)       // the value rounded to the nearest f32
lo = fround(x - hi)  // what got rounded away, itself rounded to f32
```

`hi + lo` (computed exactly, in full precision) reconstructs `x` to
roughly double the mantissa bits a single `f32` carries — a standard
"double-single" trick. Both are uploaded, and the shader recombines them
with a compensated addition (Knuth's two-sum) instead of a plain `+`:

```wgsl
fn two_sum(a: f32, b: f32) -> vec2f {
  let s = a + b;
  let v = s - a;
  let err = (a - (s - v)) + (b - v);
  return vec2f(s, err);
}
```

`two_sum(a, b)` returns not just the rounded sum `a + b` but also the exact
rounding error a plain `f32` addition would have silently discarded. Adding
that error term back in — along with the camera's `lo` residual — lets the
final world-space position carry meaningfully more precision than either
input alone, without WGSL ever touching a 64-bit float.

This has a real, specific limit worth naming honestly: it only recovers
precision when the *local offset* being added to the camera position is
itself small — exactly the situation deep zoom creates (camera parked right
next to a tiny feature, so the ray has travelled almost no distance when it
reaches the interesting detail). It does not help resolve fine detail far
down a ray that has already travelled a long way, because by then the
offset itself is already `f32`-quantized before it ever reaches the
compensated sum. In practice that's not a gap: a hit epsilon that grows
with distance travelled means far-away hits never needed sub-`f32`
precision in the first place, so the two behaviors cover complementary
territory rather than one making up for a hole in the other.

## What's deliberately out of scope

Pushing zoom depth further than this eventually meets a hard wall: even a
double-single pair only buys roughly double the mantissa, not unlimited
precision. The technique real deep-zoom fractal explorers use past that
point is perturbation rendering — compute one arbitrary-precision reference
orbit on the CPU, then render every pixel as a low-precision *delta* from
that shared reference. It's a fundamentally different rendering algorithm
built around a CPU/GPU split, not an incremental change to sphere tracing,
and it's not something to reach for until there's an actual need to zoom
deeper than double-single precision allows — building it speculatively
would be solving a problem the renderer doesn't have yet.
