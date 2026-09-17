import type { CameraController } from './input/camera-controller';
import type { Renderer } from './gpu/renderer';
import type { CoreState, MandelbulbCore } from './wasm/core';

export interface Preset {
  name: string;
  fractal: { power: number; iterations: number; bailout: number };
  camera: { position: [number, number, number]; yaw: number; pitch: number; fov: number };
  render: { maxSteps: number; epsilon: number; maxDistance: number };
  light: {
    direction: [number, number, number];
    ambient: number;
    color: [number, number, number];
    specularIntensity: number;
    shininess: number;
    shadowSoftness: number;
  };
  display: {
    exposure: number;
    gamma: number;
    fogDensity: number;
    aoIntensity: number;
    fogColor: [number, number, number];
  };
  post: { vignette: number; dither: number };
}

const DEG = Math.PI / 180;

const defaultLight = {
  direction: [0.5, 0.8, 0.3] as [number, number, number],
  ambient: 0.15,
  color: [1, 0.95, 0.9] as [number, number, number],
  specularIntensity: 0.5,
  shininess: 32,
  shadowSoftness: 16,
};

const defaultDisplay = {
  exposure: 1,
  gamma: 1,
  fogDensity: 0,
  aoIntensity: 1,
  fogColor: [0.02, 0.02, 0.05] as [number, number, number],
};

const defaultRender = { maxSteps: 128, epsilon: 0.001, maxDistance: 50 };
const defaultCamera = { position: [0, 0, 3] as [number, number, number], yaw: 0, pitch: 0, fov: 60 * DEG };
const defaultPost = { vignette: 0.3, dither: 1 };

export const PRESETS: Preset[] = [
  {
    name: 'Classic',
    fractal: { power: 8, iterations: 10, bailout: 2 },
    camera: defaultCamera,
    render: defaultRender,
    light: defaultLight,
    display: defaultDisplay,
    post: defaultPost,
  },
  {
    name: 'High Power',
    fractal: { power: 16, iterations: 12, bailout: 2 },
    camera: defaultCamera,
    render: { maxSteps: 160, epsilon: 0.0008, maxDistance: 50 },
    light: defaultLight,
    display: defaultDisplay,
    post: defaultPost,
  },
  {
    name: 'Low Power',
    fractal: { power: 3, iterations: 8, bailout: 3 },
    camera: { position: [0, 0, 4], yaw: 0, pitch: 0, fov: 60 * DEG },
    render: defaultRender,
    light: defaultLight,
    display: defaultDisplay,
    post: defaultPost,
  },
  {
    name: 'Dense',
    fractal: { power: 8, iterations: 12, bailout: 2 },
    camera: { position: [0, 0, 2.5], yaw: 0, pitch: 0, fov: 60 * DEG },
    render: { maxSteps: 200, epsilon: 0.0005, maxDistance: 50 },
    light: defaultLight,
    display: defaultDisplay,
    post: defaultPost,
  },
  {
    name: 'Spiky',
    fractal: { power: 12, iterations: 8, bailout: 1.5 },
    camera: { position: [0, 0, 3.5], yaw: 0, pitch: 0, fov: 60 * DEG },
    render: defaultRender,
    light: { ...defaultLight, shininess: 64, specularIntensity: 0.7 },
    display: defaultDisplay,
    post: { vignette: 0.4, dither: 1 },
  },
  {
    name: 'Deep Zoom',
    fractal: { power: 8, iterations: 12, bailout: 2 },
    camera: { position: [0.9, 0.35, 0.9], yaw: -0.7854, pitch: -0.2679, fov: 40 * DEG },
    render: { maxSteps: 200, epsilon: 0.0002, maxDistance: 20 },
    light: defaultLight,
    display: defaultDisplay,
    post: { vignette: 0.5, dither: 1 },
  },
];

export function captureCurrentPreset(name: string, state: CoreState, renderer: Renderer): Preset {
  return {
    name,
    fractal: { power: state.power, iterations: state.iterations, bailout: state.bailout },
    camera: {
      position: [state.cameraX, state.cameraY, state.cameraZ],
      yaw: state.cameraYaw,
      pitch: state.cameraPitch,
      fov: state.fov,
    },
    render: { ...renderer.renderParams },
    light: {
      ...renderer.light,
      direction: [...renderer.light.direction],
      color: [...renderer.light.color],
    },
    display: { ...renderer.display, fogColor: [...renderer.display.fogColor] },
    post: { ...renderer.post },
  };
}

export function applyPreset(
  preset: Preset,
  core: MandelbulbCore,
  renderer: Renderer,
  controller: CameraController,
): void {
  core.setPower(preset.fractal.power);
  core.setIterations(preset.fractal.iterations);
  core.setBailout(preset.fractal.bailout);
  core.setCameraPosition(...preset.camera.position);
  core.setCameraRotation(preset.camera.yaw, preset.camera.pitch);
  core.setFOV(preset.camera.fov);

  controller.setPose(preset.camera.position, preset.camera.yaw, preset.camera.pitch);
  controller.fov = preset.camera.fov;

  renderer.renderParams = { ...preset.render };
  renderer.light = {
    ...preset.light,
    direction: [...preset.light.direction],
    color: [...preset.light.color],
  };
  renderer.display = { ...preset.display, fogColor: [...preset.display.fogColor] };
  renderer.post = { ...preset.post };
}

export function presetToJSON(preset: Preset): string {
  return JSON.stringify(preset, null, 2);
}

export function presetFromJSON(json: string): Preset {
  return JSON.parse(json) as Preset;
}

export function downloadPreset(preset: Preset): void {
  const blob = new Blob([presetToJSON(preset)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
