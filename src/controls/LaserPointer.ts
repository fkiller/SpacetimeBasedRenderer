import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';

// Controller-attached, always-on beam (no bending) to ensure visibility in VR and desktop.
export class LaserPointer {
  readonly line: Group;
  private shaft: Mesh;
  private tip: Mesh;
  private active = true;

  constructor(color = 0x66ffcc, length = 10) {
    this.line = new Group();
    this.line.name = 'LaserPointer';

    // Shaft along -Z
    const shaftGeom = new CylinderGeometry(0.007, 0.007, length, 12, 1, true);
    shaftGeom.rotateX(Math.PI / 2); // align Y axis to Z
    const shaftMat = new MeshBasicMaterial({
      color: new Color(color),
      opacity: 0.9,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.shaft = new Mesh(shaftGeom, shaftMat);
    this.shaft.position.set(0, 0, -length / 2);
    this.shaft.frustumCulled = false;
    this.line.add(this.shaft);

    // Tip
    const tipGeom = new ConeGeometry(0.012, 0.08, 16, 1);
    tipGeom.rotateX(Math.PI / 2);
    const tipMat = new MeshBasicMaterial({
      color: new Color(color),
      opacity: 1.0,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.tip = new Mesh(tipGeom, tipMat);
    this.tip.position.set(0, 0, -length);
    this.tip.frustumCulled = false;
    this.line.add(this.tip);

    this.line.visible = this.active;
    this.line.renderOrder = 50;
  }

  update(): void {
    // No-op; beam follows controller via parenting.
  }

  setActive(active: boolean) {
    this.active = active;
    this.line.visible = active;
  }
}
