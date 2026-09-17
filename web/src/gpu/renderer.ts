import commonWGSL from '../../shaders/common.wgsl?raw';
import mandelbulbWGSL from '../../shaders/mandelbulb.wgsl?raw';
import fullscreenWGSL from '../../shaders/fullscreen.wgsl?raw';

const UNIFORM_FLOATS = 52;
const UNIFORM_SIZE = UNIFORM_FLOATS * 4;

export interface FractalParams {
  power: number;
  iterations: number;
  bailout: number;
}

export interface RenderParams {
  maxSteps: number;
  epsilon: number;
  maxDistance: number;
}

export interface Camera {
  position: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
  forward: [number, number, number];
  fov: number;
}

export interface LightParams {
  direction: [number, number, number];
  ambient: number;
  color: [number, number, number];
  specularIntensity: number;
  shininess: number;
  shadowSoftness: number;
}

export interface DisplayParams {
  exposure: number;
  gamma: number;
  fogDensity: number;
  aoIntensity: number;
  fogColor: [number, number, number];
}

export interface PostParams {
  vignette: number;
  dither: number;
}

export class Renderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private pipeline: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private startTime = performance.now();

  fractal: FractalParams = { power: 8, iterations: 10, bailout: 2 };
  renderParams: RenderParams = { maxSteps: 128, epsilon: 0.001, maxDistance: 50 };
  camera: Camera = {
    position: [0, 0, 3],
    right: [1, 0, 0],
    up: [0, 1, 0],
    forward: [0, 0, -1],
    fov: (60 * Math.PI) / 180,
  };
  light: LightParams = {
    direction: [0.5, 0.8, 0.3],
    ambient: 0.15,
    color: [1, 0.95, 0.9],
    specularIntensity: 0.5,
    shininess: 32,
    shadowSoftness: 16,
  };
  display: DisplayParams = {
    exposure: 1,
    gamma: 1,
    fogDensity: 0,
    aoIntensity: 1,
    fogColor: [0.02, 0.02, 0.05],
  };
  post: PostParams = {
    vignette: 0.3,
    dither: 1,
  };

  adapterInfo = '';
  renderScale = 1;
  supportsGPUTiming = false;
  gpuTimeMs: number | null = null;

  private cssWidth = 0;
  private cssHeight = 0;
  private timestampQuerySet: GPUQuerySet | null = null;
  private timestampResolveBuffer: GPUBuffer | null = null;
  private timestampReadbackBuffer: GPUBuffer | null = null;
  private timestampReadPending = false;

  private constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    adapterInfo: string,
  ) {
    this.device = device;
    this.context = context;
    this.adapterInfo = adapterInfo;

    const module = device.createShaderModule({
      code: `${commonWGSL}\n${mandelbulbWGSL}\n${fullscreenWGSL}`,
    });

    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    if (device.features.has('timestamp-query')) {
      this.supportsGPUTiming = true;
      this.timestampQuerySet = device.createQuerySet({ type: 'timestamp', count: 2 });
      this.timestampResolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });
      this.timestampReadbackBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
    }
  }

  static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No suitable GPU adapter found');
    }

    const requiredFeatures: GPUFeatureName[] = adapter.features.has('timestamp-query')
      ? ['timestamp-query']
      : [];
    const device = await adapter.requestDevice({ requiredFeatures });
    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Failed to acquire WebGPU canvas context');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });

    const info = adapter.info;
    const adapterInfo = info ? `${info.vendor} ${info.architecture} ${info.description}`.trim() : 'unknown GPU';

    return new Renderer(device, context, format, adapterInfo);
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(cssWidth * dpr * this.renderScale));
    const height = Math.max(1, Math.floor(cssHeight * dpr * this.renderScale));

    const canvas = this.context.canvas as HTMLCanvasElement;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  refreshSize(): void {
    this.resize(this.cssWidth, this.cssHeight);
  }

  private writeUniforms(): void {
    const canvas = this.context.canvas as HTMLCanvasElement;
    const time = (performance.now() - this.startTime) / 1000;
    const c = this.camera;
    const f = this.fractal;
    const r = this.renderParams;
    const l = this.light;
    const d = this.display;
    const p = this.post;

    // Camera position is split into an f32 (hi, lo) pair so the shader can
    // recover precision beyond a single f32 via compensated summation
    // (world_pos in fullscreen.wgsl) — see docs/precision.md.
    const posHi = c.position.map(Math.fround) as [number, number, number];
    const posLo = c.position.map((x, i) => Math.fround(x - posHi[i])) as [number, number, number];

    const data = new Float32Array([
      canvas.width, canvas.height, time, c.fov,
      posHi[0], posHi[1], posHi[2], f.power,
      c.right[0], c.right[1], c.right[2], f.iterations,
      c.up[0], c.up[1], c.up[2], f.bailout,
      c.forward[0], c.forward[1], c.forward[2], r.maxSteps,
      r.epsilon, r.maxDistance, 0, 0,
      l.direction[0], l.direction[1], l.direction[2], l.ambient,
      l.color[0], l.color[1], l.color[2], l.specularIntensity,
      l.shininess, l.shadowSoftness, 0, 0,
      d.exposure, d.gamma, d.fogDensity, d.aoIntensity,
      d.fogColor[0], d.fogColor[1], d.fogColor[2], 0,
      posLo[0], posLo[1], posLo[2], 0,
      p.vignette, p.dither, 0, 0,
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  render(): void {
    this.writeUniforms();

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      timestampWrites: this.timestampQuerySet
        ? {
            querySet: this.timestampQuerySet,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          }
        : undefined,
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();

    const readback = this.timestampReadbackBuffer;
    if (this.timestampQuerySet && this.timestampResolveBuffer && readback && !this.timestampReadPending) {
      encoder.resolveQuerySet(this.timestampQuerySet, 0, 2, this.timestampResolveBuffer, 0);
      encoder.copyBufferToBuffer(this.timestampResolveBuffer, 0, readback, 0, 16);
      this.device.queue.submit([encoder.finish()]);
      this.readGPUTiming(readback);
    } else {
      this.device.queue.submit([encoder.finish()]);
    }
  }

  private readGPUTiming(readback: GPUBuffer): void {
    this.timestampReadPending = true;
    readback
      .mapAsync(GPUMapMode.READ)
      .then(() => {
        const times = new BigInt64Array(readback.getMappedRange());
        const deltaNs = Number(times[1] - times[0]);
        readback.unmap();
        if (deltaNs >= 0) {
          this.gpuTimeMs = deltaNs / 1e6;
        }
        this.timestampReadPending = false;
      })
      .catch(() => {
        this.timestampReadPending = false;
      });
  }
}
