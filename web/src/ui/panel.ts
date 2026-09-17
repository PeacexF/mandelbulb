import type { Renderer } from '../gpu/renderer';
import type { CameraController } from '../input/camera-controller';
import type { MandelbulbCore } from '../wasm/core';
import { PRESETS, applyPreset, captureCurrentPreset, downloadPreset, presetFromJSON } from '../presets';

const DEG = Math.PI / 180;

function rgbToHex(rgb: [number, number, number]): string {
  const c = rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0'));
  return `#${c.join('')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function section(parent: HTMLElement, title: string): HTMLElement {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = title;
  fieldset.append(legend);
  parent.append(fieldset);
  return fieldset;
}

export interface Panel {
  refresh(): void;
  updateDiagnostics(fps: number, frameMs: number): void;
  toggle(): void;
}

export function createPanel(core: MandelbulbCore, renderer: Renderer, controller: CameraController): Panel {
  const root = document.createElement('div');
  root.id = 'panel';
  document.body.append(root);

  const refreshers: (() => void)[] = [];

  function bindSlider(
    parent: HTMLElement,
    label: string,
    min: number,
    max: number,
    step: number,
    get: () => number,
    format: (v: number) => string,
    set: (v: number) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(get());

    const readout = document.createElement('span');
    readout.className = 'readout';
    readout.textContent = format(get());

    input.addEventListener('input', () => {
      set(parseFloat(input.value));
    });

    row.append(labelEl, input, readout);
    parent.append(row);

    refreshers.push(() => {
      const v = get();
      if (document.activeElement !== input) {
        input.value = String(v);
      }
      readout.textContent = format(v);
    });
  }

  const fractalSection = section(root, 'Fractal');
  bindSlider(fractalSection, 'Power', 1, 20, 0.1, () => renderer.fractal.power, (v) => v.toFixed(1), (v) => core.setPower(v));
  bindSlider(fractalSection, 'Iterations', 1, 30, 1, () => renderer.fractal.iterations, (v) => String(v), (v) => core.setIterations(v));
  bindSlider(fractalSection, 'Bailout', 0.5, 5, 0.1, () => renderer.fractal.bailout, (v) => v.toFixed(1), (v) => core.setBailout(v));

  const rendererSection = section(root, 'Renderer');
  bindSlider(rendererSection, 'Max Steps', 16, 512, 1, () => renderer.renderParams.maxSteps, (v) => String(v), (v) => {
    renderer.renderParams.maxSteps = v;
  });
  bindSlider(rendererSection, 'Epsilon', 0.00005, 0.01, 0.00005, () => renderer.renderParams.epsilon, (v) => v.toFixed(5), (v) => {
    renderer.renderParams.epsilon = v;
  });
  bindSlider(rendererSection, 'Max Distance', 5, 200, 1, () => renderer.renderParams.maxDistance, (v) => String(v), (v) => {
    renderer.renderParams.maxDistance = v;
  });
  bindSlider(rendererSection, 'AO', 0, 1, 0.01, () => renderer.display.aoIntensity, (v) => v.toFixed(2), (v) => {
    renderer.display.aoIntensity = v;
  });
  bindSlider(rendererSection, 'Shadow Softness', 1, 64, 1, () => renderer.light.shadowSoftness, (v) => String(v), (v) => {
    renderer.light.shadowSoftness = v;
  });
  bindSlider(rendererSection, 'Render Scale', 0.1, 2, 0.05, () => renderer.renderScale, (v) => v.toFixed(2), (v) => {
    renderer.renderScale = v;
  });

  const cameraSection = section(root, 'Camera');
  bindSlider(cameraSection, 'FOV', 20, 120, 1, () => controller.fov / DEG, (v) => `${v.toFixed(0)}°`, (v) => {
    controller.fov = v * DEG;
  });
  bindSlider(cameraSection, 'Move Speed', 0.1, 10, 0.1, () => controller.moveSpeed, (v) => v.toFixed(1), (v) => {
    controller.moveSpeed = v;
  });

  const displaySection = section(root, 'Display');
  bindSlider(displaySection, 'Exposure', 0.1, 3, 0.05, () => renderer.display.exposure, (v) => v.toFixed(2), (v) => {
    renderer.display.exposure = v;
  });
  bindSlider(displaySection, 'Gamma', 1, 3, 0.05, () => renderer.display.gamma, (v) => v.toFixed(2), (v) => {
    renderer.display.gamma = v;
  });
  bindSlider(displaySection, 'Fog Density', 0, 1, 0.01, () => renderer.display.fogDensity, (v) => v.toFixed(2), (v) => {
    renderer.display.fogDensity = v;
  });

  const fogColorRow = document.createElement('div');
  fogColorRow.className = 'row';
  const fogColorLabel = document.createElement('label');
  fogColorLabel.textContent = 'Fog Color';
  const fogColorInput = document.createElement('input');
  fogColorInput.type = 'color';
  fogColorInput.value = rgbToHex(renderer.display.fogColor);
  fogColorInput.addEventListener('input', () => {
    renderer.display.fogColor = hexToRgb(fogColorInput.value);
  });
  fogColorRow.append(fogColorLabel, fogColorInput);
  displaySection.append(fogColorRow);
  refreshers.push(() => {
    if (document.activeElement !== fogColorInput) {
      fogColorInput.value = rgbToHex(renderer.display.fogColor);
    }
  });

  const postSection = section(root, 'Post-Processing');
  bindSlider(postSection, 'Vignette', 0, 1, 0.01, () => renderer.post.vignette, (v) => v.toFixed(2), (v) => {
    renderer.post.vignette = v;
  });
  bindSlider(postSection, 'Dither', 0, 4, 0.1, () => renderer.post.dither, (v) => v.toFixed(1), (v) => {
    renderer.post.dither = v;
  });

  const presetsSection = section(root, 'Presets');
  const presetButtons = document.createElement('div');
  presetButtons.className = 'presets';
  PRESETS.forEach((preset, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${i + 1}. ${preset.name}`;
    btn.addEventListener('click', () => applyPreset(preset, core, renderer, controller));
    presetButtons.append(btn);
  });
  presetsSection.append(presetButtons);

  const ioRow = document.createElement('div');
  ioRow.className = 'row';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save JSON';
  saveBtn.addEventListener('click', () => {
    downloadPreset(captureCurrentPreset('custom', core.getState(), renderer));
  });

  const loadBtn = document.createElement('button');
  loadBtn.textContent = 'Load JSON';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    file.text().then((text) => {
      applyPreset(presetFromJSON(text), core, renderer, controller);
    });
  });
  loadBtn.addEventListener('click', () => fileInput.click());

  ioRow.append(saveBtn, loadBtn, fileInput);
  presetsSection.append(ioRow);

  const diagSection = section(root, 'Diagnostics');
  const diagText = document.createElement('pre');
  diagText.className = 'diagnostics';
  diagSection.append(diagText);

  return {
    refresh() {
      for (const r of refreshers) {
        r();
      }
    },
    updateDiagnostics(fps, frameMs) {
      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      const r = renderer.renderParams;
      const gpuMs = renderer.supportsGPUTiming && renderer.gpuTimeMs !== null ? renderer.gpuTimeMs.toFixed(2) : 'n/a';
      diagText.textContent = [
        `FPS: ${fps.toFixed(0)}`,
        `Frame (CPU): ${frameMs.toFixed(2)} ms`,
        `Frame (GPU): ${gpuMs} ms`,
        `Internal res: ${canvas.width}x${canvas.height}`,
        `Steps/Eps/Dist: ${r.maxSteps}/${r.epsilon}/${r.maxDistance}`,
        `GPU: ${renderer.adapterInfo}`,
      ].join('\n');
    },
    toggle() {
      root.classList.toggle('hidden');
    },
  };
}
