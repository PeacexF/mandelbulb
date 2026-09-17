import type { Camera as CameraUniform } from '../gpu/renderer';
import type { InputState } from './input-state';

type Vec3 = [number, number, number];

const WORLD_UP: Vec3 = [0, 1, 0];
const MAX_PITCH = (89 * Math.PI) / 180;
const DEG = Math.PI / 180;

function vAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function vLength(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function vNormalize(a: Vec3): Vec3 {
  const len = vLength(a);
  return len > 1e-9 ? vScale(a, 1 / len) : [0, 0, 0];
}

function vCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vLerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function basisFromYawPitch(yaw: number, pitch: number): { forward: Vec3; right: Vec3; up: Vec3 } {
  const forward: Vec3 = [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
  const right = vNormalize(vCross(forward, WORLD_UP));
  const up = vCross(right, forward);
  return { forward, right, up };
}

export type CameraMode = 'free' | 'orbit';

export class CameraController {
  mode: CameraMode = 'free';
  fov = 60 * DEG;
  moveSpeed = 1.5;
  fastMultiplier = 4;
  mouseSensitivity = 0.0025;

  private free = { position: [0, 0, 3] as Vec3, yaw: 0, pitch: 0, velocity: [0, 0, 0] as Vec3 };
  private orbit = { target: [0, 0, 0] as Vec3, yaw: 0, pitch: 0, distance: 3 };

  toggleMode(): void {
    this.mode = this.mode === 'free' ? 'orbit' : 'free';
  }

  look(dx: number, dy: number): void {
    const s = this.mode === 'free' ? this.free : this.orbit;
    s.yaw += dx * this.mouseSensitivity;
    s.pitch = clamp(s.pitch - dy * this.mouseSensitivity, -MAX_PITCH, MAX_PITCH);
  }

  zoom(wheelDelta: number): void {
    if (this.mode !== 'orbit') {
      return;
    }
    this.orbit.distance = clamp(this.orbit.distance * Math.exp(wheelDelta * 0.001), 0.01, 100);
  }

  update(dt: number, input: InputState): void {
    if (this.mode === 'free') {
      this.updateFree(dt, input);
    } else {
      this.updateOrbit(dt, input);
    }
  }

  private updateFree(dt: number, input: InputState): void {
    const { forward, right } = basisFromYawPitch(this.free.yaw, this.free.pitch);

    let dir: Vec3 = [0, 0, 0];
    if (input.isDown('KeyW')) dir = vAdd(dir, forward);
    if (input.isDown('KeyS')) dir = vSub(dir, forward);
    if (input.isDown('KeyD')) dir = vAdd(dir, right);
    if (input.isDown('KeyA')) dir = vSub(dir, right);
    if (input.isDown('KeyE')) dir = vAdd(dir, WORLD_UP);
    if (input.isDown('KeyQ')) dir = vSub(dir, WORLD_UP);

    const fast = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = this.moveSpeed * (fast ? this.fastMultiplier : 1);
    const target = vLength(dir) > 1e-6 ? vScale(vNormalize(dir), speed) : ([0, 0, 0] as Vec3);

    const damping = 1 - Math.exp(-dt * 8);
    this.free.velocity = vLerp(this.free.velocity, target, damping);
    this.free.position = vAdd(this.free.position, vScale(this.free.velocity, dt));
  }

  private updateOrbit(dt: number, input: InputState): void {
    const zoomSpeed = this.orbit.distance * 1.5;
    if (input.isDown('KeyW')) {
      this.orbit.distance = Math.max(0.01, this.orbit.distance - zoomSpeed * dt);
    }
    if (input.isDown('KeyS')) {
      this.orbit.distance = this.orbit.distance + zoomSpeed * dt;
    }
  }

  getUniform(): CameraUniform {
    if (this.mode === 'free') {
      const { forward, right, up } = basisFromYawPitch(this.free.yaw, this.free.pitch);
      return { position: this.free.position, right, up, forward, fov: this.fov };
    }

    const { forward, right, up } = basisFromYawPitch(this.orbit.yaw, this.orbit.pitch);
    const position = vSub(this.orbit.target, vScale(forward, this.orbit.distance));
    return { position, right, up, forward, fov: this.fov };
  }
}
