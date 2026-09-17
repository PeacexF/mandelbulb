import { Renderer } from './gpu/renderer';
import { InputState } from './input/input-state';
import { CameraController } from './input/camera-controller';
import { loadCore } from './wasm/core';

async function main(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = await Renderer.create(canvas);
  const core = await loadCore();
  const input = new InputState();
  const controller = new CameraController();

  let state = core.getState();

  const hint = document.getElementById('hint') as HTMLDivElement;
  canvas.addEventListener('click', () => {
    canvas.requestPointerLock()?.catch(() => {});
  });
  document.addEventListener('pointerlockchange', () => {
    hint.style.display = document.pointerLockElement ? 'none' : 'block';
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') {
      controller.toggleMode();
    } else if (e.code === 'BracketRight') {
      core.setPower(state.power + 1);
    } else if (e.code === 'BracketLeft') {
      core.setPower(state.power - 1);
    } else if (e.code === 'KeyR') {
      core.reset();
      controller.reset();
    }
  });

  const resize = (): void => {
    renderer.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resize);
  resize();

  let lastTime = performance.now();
  const frame = (): void => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const [dx, dy] = input.consumeMouseDelta();
    if (dx !== 0 || dy !== 0) {
      controller.look(dx, dy);
    }
    const wheel = input.consumeWheelDelta();
    if (wheel !== 0) {
      controller.zoom(wheel);
    }
    controller.update(dt, input);

    const pose = controller.getPose();
    core.setCameraPosition(pose.position[0], pose.position[1], pose.position[2]);
    core.setCameraRotation(pose.yaw, pose.pitch);
    core.setFOV(pose.fov);
    state = core.getState();

    renderer.camera = controller.getUniform();
    renderer.fractal = { power: state.power, iterations: state.iterations, bailout: state.bailout };
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:red;padding:1rem';
  pre.textContent = String(err);
  document.body.replaceChildren(pre);
});
