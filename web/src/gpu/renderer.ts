import commonWGSL from '../../shaders/common.wgsl?raw';
import mandelbulbWGSL from '../../shaders/mandelbulb.wgsl?raw';
import fullscreenWGSL from '../../shaders/fullscreen.wgsl?raw';

const UNIFORM_FLOATS = 36;
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

  private constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
  ) {
    this.device = device;
    this.context = context;

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
  }

  static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No suitable GPU adapter found');
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Failed to acquire WebGPU canvas context');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });

    return new Renderer(device, context, format);
  }

  resize(width: number, height: number): void {
    const canvas = this.context.canvas as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
  }

  private writeUniforms(): void {
    const canvas = this.context.canvas as HTMLCanvasElement;
    const time = (performance.now() - this.startTime) / 1000;
    const c = this.camera;
    const f = this.fractal;
    const r = this.renderParams;
    const l = this.light;

    const data = new Float32Array([
      canvas.width, canvas.height, time, c.fov,
      c.position[0], c.position[1], c.position[2], f.power,
      c.right[0], c.right[1], c.right[2], f.iterations,
      c.up[0], c.up[1], c.up[2], f.bailout,
      c.forward[0], c.forward[1], c.forward[2], r.maxSteps,
      r.epsilon, r.maxDistance, 0, 0,
      l.direction[0], l.direction[1], l.direction[2], l.ambient,
      l.color[0], l.color[1], l.color[2], l.specularIntensity,
      l.shininess, l.shadowSoftness, 0, 0,
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
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }
}
