# Architecture

## Layers

```
input (keyboard, mouse)
        │
camera controller (TypeScript)
        │
        ▼
Go application state ──compiled to──▶ WebAssembly
  (fractal params,                        │
   camera pose)                           │
        ▲                                 │
        └─────────── read back ───────────┘
        │
        ▼
uniform buffer (TypeScript → GPU)
        │
        ▼
WGSL fragment shader
  ray generation → sphere tracing → shading → post-processing
        │
        ▼
      pixels
```

Three languages, each doing the part it's suited for:

- **WGSL** does all of the expensive, embarrassingly-parallel work: every
  pixel's ray march, distance-field evaluation, normal estimation, and
  shading happens on the GPU, every frame. The CPU never touches a pixel.
- **Go**, compiled to WebAssembly, owns *validated application state* —
  the fractal parameters and camera pose. It exposes a small set of setters
  (`setPower`, `setCameraPosition`, ...) that validate input and a
  `getState` that returns the current snapshot. This state is also what
  `core/fractal`'s Go tests exercise directly, in full 64-bit precision, on
  the CPU — independent of the GPU pipeline entirely, so the fractal math
  itself can be verified without a browser or a graphics driver.
- **TypeScript** is everything in between: turning input events into smooth
  camera movement frame to frame (a concern that needs tight coupling to
  the render loop, not a good fit for a request/response WASM boundary),
  driving the WebGPU pipeline, and packing the current state into the
  uniform buffer the shader reads.

## Why state lives in Go instead of just TypeScript

Camera movement itself — the moment-to-moment integration of input into a
smoothly moving position — stays in TypeScript, because it needs to run
every frame with no meaningful validation step. What moves to Go is the
*settled* state: the fractal's parameters and the camera's current pose,
values a user can set directly (a slider, a preset, a saved file) where
having one validated, testable source of truth matters more than raw
per-frame latency. Each frame, the TypeScript camera controller computes a
new pose and pushes it into Go; each frame, the renderer reads the current
state back out via `getState()` before building the GPU uniforms. Go
rejects invalid values (e.g. a negative iteration count) and clamps others
(pitch, to avoid flipping past vertical) — that validation is written and
tested once, in one place, rather than duplicated in every UI control that
could change the value.

## The render pipeline

The GPU pipeline is a single triangle covering the screen and a single
fragment shader — there's no geometry to rasterize, since the fractal is
defined implicitly by a distance function, not a mesh. Everything the
fragment shader needs (camera pose, fractal parameters, render quality
settings, lighting, display/post-processing settings) comes from one
uniform buffer, laid out as a flat struct of `vec4`s for straightforward
alignment. The shader itself is organized as: build a camera ray for the
current pixel, sphere-trace it against the Mandelbulb's distance estimator,
and on a hit, estimate a normal and shade it (diffuse, specular, soft
shadow, ambient occlusion), then apply fog, tone mapping, vignette, and
dithering before writing the pixel.

## Presets

A preset is a full snapshot of everything that affects the image: fractal
parameters, camera pose, render quality, lighting, and display/post
settings. Applying one pushes fractal and camera values through the same
Go setters normal interaction uses (so validation still applies) and
assigns the rest directly to the renderer. Presets are plain JSON, so
saving one is just serializing that snapshot and loading one is parsing it
back into the same shape — no separate save format to maintain.
