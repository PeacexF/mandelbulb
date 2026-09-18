export interface CoreState {
  power: number;
  iterations: number;
  bailout: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  cameraYaw: number;
  cameraPitch: number;
  fov: number;
}

export interface MandelbulbCore {
  setPower(v: number): string | null;
  setIterations(v: number): string | null;
  setBailout(v: number): string | null;
  setCameraPosition(x: number, y: number, z: number): void;
  setCameraRotation(yaw: number, pitch: number): void;
  setFOV(v: number): string | null;
  reset(): void;
  getState(): CoreState;
}

interface GoInstance {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

declare global {
  interface Window {
    Go: new () => GoInstance;
    mandelbulbCore: MandelbulbCore;
    __mandelbulbReady?: () => void;
  }
}

export async function loadCore(): Promise<MandelbulbCore> {
  const ready = new Promise<void>((resolve) => {
    window.__mandelbulbReady = resolve;
  });

  const go = new window.Go();
  const wasmUrl = `${import.meta.env.BASE_URL}mandelbulb.wasm`;
  const result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), go.importObject);
  void go.run(result.instance);

  await ready;
  return window.mandelbulbCore;
}
