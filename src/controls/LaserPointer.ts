import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Vector3,
} from 'three';
import { type BlackHoleData } from '../scene/SpacetimeWorld';

const SEGMENTS = 28;
const MAX_LENGTH = 16;
const FORCE_SCALE = 0.12;

export class LaserPointer {
  readonly line: Line;
  private geometry: BufferGeometry;
  private positions: Float32Array;
  private workingDir = new Vector3();
  private workingPos = new Vector3();
  private workingForce = new Vector3();
  private temp = new Vector3();
  private active = false;

  constructor(color = 0x7ab7ff) {
    this.positions = new Float32Array(SEGMENTS * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));

    const material = new LineBasicMaterial({ color, linewidth: 3, transparent: true, opacity: 0.9 });
    this.line = new Line(this.geometry, material);
    this.line.frustumCulled = false;
    this.line.visible = this.active;
  }

  update(origin: Vector3, direction: Vector3, blackHoles: BlackHoleData[]): void {
    if (!this.active) {
      return;
    }
    this.workingPos.copy(origin);
    this.workingDir.copy(direction).normalize();

    const step = MAX_LENGTH / (SEGMENTS - 1);
    for (let i = 0; i < SEGMENTS; i += 1) {
      const idx = i * 3;
      this.positions[idx] = this.workingPos.x;
      this.positions[idx + 1] = this.workingPos.y;
      this.positions[idx + 2] = this.workingPos.z;

      this.applyGravitationalBend(blackHoles, step);
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  private applyGravitationalBend(blackHoles: BlackHoleData[], step: number) {
    this.workingForce.set(0, 0, 0);
    for (const bh of blackHoles) {
      const toBH = this.temp.subVectors(bh.position, this.workingPos);
      const distSq = Math.max(0.05, toBH.lengthSq());
      const accel = toBH.multiplyScalar((bh.mass * FORCE_SCALE) / distSq);
      this.workingForce.add(accel);
    }

    this.workingDir.addScaledVector(this.workingForce, step).normalize();
    this.workingPos.addScaledVector(this.workingDir, step);
  }

  setActive(active: boolean) {
    this.active = active;
    this.line.visible = active;
  }
}
