import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  Vector3,
} from 'three';

export interface FieldSource {
  position: Vector3;
  mass: number;
  radius: number;
}

// Curved beam that bends toward gravitational sources.
export class BentLaser {
  readonly line: Line<BufferGeometry, LineBasicMaterial>;

  private readonly positions: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly material: LineBasicMaterial;
  private readonly maxSegments: number;
  private readonly maxLength: number;
  private readonly step: number;
  private readonly gravityStrength = 1.0;
  private readonly bendStrength = 0.75;
  private readonly maxTurnPerStep = 0.1; // radians
  private readonly softening = 0.08;
  private readonly softeningSq = this.softening * this.softening;
  private active = true;

  private tmpPos = new Vector3();
  private tmpDir = new Vector3();
  private tmpAccel = new Vector3();
  private tmpDiff = new Vector3();
  private tmpPerp = new Vector3();

  constructor(color = 0xfff1c4, maxLength = 10, segments = 120) {
    this.maxSegments = segments;
    this.maxLength = maxLength;
    this.step = maxLength / segments;

    this.positions = new Float32Array((segments + 1) * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setDrawRange(0, 0);

    this.material = new LineBasicMaterial({
      color: new Color(color),
      linewidth: 1.5,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    });

    this.line = new Line(this.geometry, this.material);
    this.line.name = 'BentLaser';
    this.line.frustumCulled = false;
    this.line.renderOrder = 45;
    this.line.matrixAutoUpdate = false; // positions are absolute
    this.line.visible = this.active;
  }

  setActive(active: boolean) {
    this.active = active;
    this.line.visible = active;
  }

  updatePath(origin: Vector3, direction: Vector3, sources: FieldSource[]): void {
    this.line.visible = this.active;
    if (!this.active) return;

    this.tmpPos.copy(origin);
    this.tmpDir.copy(direction).normalize();

    // First point
    this.positions[0] = this.tmpPos.x;
    this.positions[1] = this.tmpPos.y;
    this.positions[2] = this.tmpPos.z;
    let pointCount = 1;

    for (let i = 1; i <= this.maxSegments; i += 1) {
      this.computeAcceleration(this.tmpPos, sources, this.tmpAccel);

      // Remove component parallel to current direction so we only bend, not speed up.
      const parallel = this.tmpDir.dot(this.tmpAccel);
      this.tmpPerp.copy(this.tmpAccel).addScaledVector(this.tmpDir, -parallel);

      const perpMag = this.tmpPerp.length();
      if (perpMag > 1e-6) {
        const rawDelta = perpMag * this.bendStrength * this.step;
        const limitedDelta = Math.min(rawDelta, this.maxTurnPerStep);
        const scale = limitedDelta / perpMag;
        this.tmpDir.addScaledVector(this.tmpPerp, scale).normalize();
      }

      this.tmpPos.addScaledVector(this.tmpDir, this.step);

      const baseIndex = pointCount * 3;
      this.positions[baseIndex] = this.tmpPos.x;
      this.positions[baseIndex + 1] = this.tmpPos.y;
      this.positions[baseIndex + 2] = this.tmpPos.z;
      pointCount += 1;

      if (this.intersectsSource(this.tmpPos, sources)) {
        break;
      }
    }

    this.geometry.setDrawRange(0, pointCount);
    const positionAttr = this.geometry.getAttribute('position') as BufferAttribute;
    positionAttr.needsUpdate = true;
  }

  private computeAcceleration(pos: Vector3, sources: FieldSource[], out: Vector3) {
    out.set(0, 0, 0);
    for (const source of sources) {
      this.tmpDiff.subVectors(source.position, pos);
      const distSq = this.tmpDiff.lengthSq() + this.softeningSq;
      const invR = 1 / Math.sqrt(distSq);
      const invR3 = invR * invR * invR;
      out.addScaledVector(this.tmpDiff, this.gravityStrength * source.mass * invR3);
    }
  }

  private intersectsSource(pos: Vector3, sources: FieldSource[]): boolean {
    for (const source of sources) {
      const limit = source.radius * 1.05;
      if (pos.distanceToSquared(source.position) <= limit * limit) {
        return true;
      }
    }
    return false;
  }
}
