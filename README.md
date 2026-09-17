# Mandelbulb

Real-time 3D Mandelbulb renderer running in the browser.

Built from scratch with **Go + WebAssembly + TypeScript + WebGPU + WGSL**.

![Mandelbulb](./.github/img/preview.png)

## Stack

* Go — core state and numerical logic
* WebAssembly — Go ↔ browser bridge
* TypeScript — application and controls
* WebGPU — GPU rendering
* WGSL — ray marching and fractal rendering
* Vite — frontend tooling

## Features

* Real-time Mandelbulb rendering
* GPU ray marching
* Adjustable fractal parameters
* Free-flight 3D camera
* Procedural lighting
* Deep zoom exploration
* Rendering diagnostics
* Presets

## Architecture

```text
TypeScript
    │
    ├── UI / input
    │
    ↓
WebAssembly
    │
    ↓
Go core
    │
    └── state / parameters
            │
            ↓
         WebGPU
            │
            ↓
          WGSL
            │
       ray marching
            │
            ↓
          pixels
```

The expensive per-pixel work is performed on the GPU. Go and WebAssembly handle application-side state and numerical logic rather than transferring rendered pixels through the WASM boundary.

For the actual math and a deeper architectural walkthrough, see:

* [`docs/mandelbulb.md`](./docs/mandelbulb.md) — the fractal formula, distance estimation, sphere tracing, and shading
* [`docs/architecture.md`](./docs/architecture.md) — how the Go/WASM/TypeScript/WGSL layers fit together
* [`docs/precision.md`](./docs/precision.md) — where `f32` breaks down and what the renderer does about it

## Running

Requirements:

* Go
* Node.js
* A browser with WebGPU support

```bash
git clone https://github.com/PeacexF/mandelbulb
cd mandelbulb

make install
make dev
```

Open the local development server in a WebGPU-compatible browser.

Other useful targets: `make build` (production bundle), `make test` (Go tests), `make check` (vet + lint + test + typecheck). Run `make help` for the full list.

## Controls

| Key / Input   | Action                    |
| ------------- | ------------------------- |
| `W A S D`     | Move                      |
| `Q / E`       | Move vertically           |
| `Shift`       | Move faster               |
| Mouse         | Look (click to lock)      |
| `C`           | Toggle free-fly / orbit   |
| Scroll        | Zoom (orbit mode)         |
| `[` / `]`     | Decrease / increase power |
| `R`           | Reset                     |
| `H`           | Show / hide the panel     |
| `1`–`6`       | Load a preset             |

Fractal, renderer, camera, display, and post-processing parameters all have
sliders in the panel, including saving/loading a full configuration as JSON.

## License

MIT
