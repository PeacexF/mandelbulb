# The Mandelbulb: Math and Rendering

## The fractal

The Mandelbrot set is defined over the complex plane by iterating `z = z² +
c` and asking, for each starting point `c`, whether the orbit of `z`
escapes to infinity. There is no 3D equivalent of complex multiplication,
so there's no single "correct" way to extend this to three dimensions —
the Mandelbulb is one particular choice (popularized by Daniel White and
Paul Nylander) that generalizes `z²` to `zⁿ` using spherical coordinates
instead of complex arithmetic:

```
given a point p, iterate:

  z = p
  repeat:
    r     = |z|
    θ     = acos(z.z / r)      // polar angle
    φ     = atan2(z.y, z.x)    // azimuthal angle

    z = rⁿ · ( sin(nθ)·cos(nφ), sin(nθ)·sin(nφ), cos(nθ) )
    z = z + p
```

This raises `z` to the `n`-th power by scaling its radius by `rⁿ` and
multiplying both spherical angles by `n` — the direct analogue of what
complex exponentiation does to modulus and argument. `n = 8` is the
canonical "Mandelbulb" and what this renderer uses by default, but the
implementation (`core/fractal/mandelbulb.go`, and `mandelbulb.wgsl` on the
GPU side) treats `n` as a free parameter.

As with the Mandelbrot set, a point belongs to the set if this orbit stays
bounded forever; in practice, the iteration is stopped early (bailout) once
`r` exceeds some threshold, since a point that has escaped that far will
diverge to infinity.

## Distance estimation

A ray marcher doesn't need to know *whether* a point is in the set — it
needs to know a *safe distance* it can step forward without passing through
the surface. Computing that exactly for a fractal boundary isn't tractable,
so the renderer uses the same heuristic used across fractal rendering:
track how fast the iteration's derivative grows alongside the orbit itself,
and use it to estimate distance via potential theory borrowed from the
(rigorously understood) Mandelbrot case:

```
z = p, dr = 1, r = 0
repeat (bailing out early if r exceeds the escape radius):
  r  = |z|
  dr = r^(n-1) · n · dr + 1        // running derivative of |z| w.r.t. p
  z  = (the spherical power step above)

distance ≈ 0.5 · ln(r) · r / dr
```

`dr` accumulates (via the chain rule) how sensitive the final `|z|` is to
the starting point `p` — intuitively, how fast nearby points' orbits are
diverging from each other. Where they diverge quickly, the surface is
close; where they diverge slowly, there's more room to step. This is an
accepted heuristic rather than an exact distance bound for the Mandelbulb
specifically (the underlying theory is exact only for the 2D Mandelbrot
set), but it produces a distance estimator that behaves well enough in
practice for sphere tracing, which is why virtually every real-time
Mandelbulb renderer uses the same formula.

## Sphere tracing (ray marching)

Given a distance estimator, rendering becomes: for each pixel, walk a ray
outward from the camera, always advancing by (at least) the estimated
distance to the nearest surface — which is guaranteed not to intersect
anything closer than that — until either the estimate drops below a small
threshold (a hit) or the ray has travelled further than a maximum draw
distance (a miss):

```
t = 0
repeat up to max_steps times:
  p = camera + ray_direction · t
  d = distance_estimate(p)
  if d < epsilon: hit, surface is at t
  t += d
  if t > max_distance: miss
```

This is cheaper than the fixed small-step marching a naive implementation
might do, since each step is exactly as large as it can safely be. It's
also the reason the shape of the distance estimator (not just whether it's
correct at the surface) determines performance: a DE that underestimates
badly forces small, wasteful steps.

The renderer additionally scales the hit threshold with distance travelled
(matching it to the world-space size of one screen pixel at that distance)
and uses a compensated-precision reconstruction of the ray position for
positions very close to the camera — both described in
[`precision.md`](precision.md), since they exist specifically to keep this
algorithm well-behaved when zoomed in close to fine detail.

## Normals and shading

The surface normal at a hit point is the gradient of the distance field,
estimated by sampling the distance estimator at a few nearby offsets and
looking at how it changes. A textbook central-difference gradient needs 6
samples (±x, ±y, ±z); this renderer uses a 4-sample "tetrahedral" variant
instead — four non-coplanar directions are mathematically sufficient to
recover a 3D gradient, and each sample here means a full pass through the
fractal's iteration, so cutting from 6 to 4 is a meaningful cost reduction.

From there, shading is a standard local lighting model: Lambertian diffuse
and Blinn-Phong specular from one directional light, ambient occlusion
approximated by sampling the distance field a few steps out along the
normal (a surface that's more enclosed by nearby geometry reports shorter
distances, which this turns into a darkening factor), and soft shadows from
a second, coarser sphere-trace cast from the surface toward the light.
